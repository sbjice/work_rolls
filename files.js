const fastcsv = require('fast-csv');

const fsPromises = require('fs/promises');

const splitDataRecordsToChunks = (data, chunkLength = 350) => {
  const chunksBoundaries = [];
  if (data.length <= chunkLength) {
    chunksBoundaries.push({start: 0, end: data.length - 1})
  }

  for (let i = 0; i < Math.ceil(data.length / chunkLength); i += 1) {
    let boundary;
    if (i === 0) {
      boundary = {
        start: 0,
        end: chunkLength - 1,
      } 
    } else if (i === Math.ceil(data.length / chunkLength) - 1) {
      boundary = {
        start: chunksBoundaries[i - 1].end + 1,
        end: data.length - 1,
      } 
    } else {
      boundary = {
        start: chunksBoundaries[i - 1].end + 1,
        end: chunksBoundaries[i - 1].end + chunkLength,
      } 
    }
    chunksBoundaries.push(boundary);
  }
  return chunksBoundaries;
}


const readDataFromFile = (filepath) => {
  const rowsData = [];
  // console.log(filepath);
  return fsPromises.readFile(`${filepath}`, {
      encoding: 'utf8'
    })
    .then(fastcsv.parse({
      headers: true
    }))
    .catch(error => {
      return error;
    })
    .then(data => {
      // console.log(data);
      return data.split('\n');
    })
    .then(data => {
      let passNumbers = [];
      // console.log(data[1], data[2]);
      if (data[1].split(';')[3] !== data[2].split(';')[3]) {
        data = [data[0], ...data.slice(2)];
      }

      data.forEach((element, index) => {
        const [position, thickness, length, pass, time] = element.split(';');
        rowsData.push({
          position,
          thickness,
          length,
          pass,
          time
        });
        if (index !== 0) {
          if (passNumbers.length === 0) {
            passNumbers.push(pass);
          } else {
            passNumbers[passNumbers.length - 1] !== pass ? passNumbers.push(pass) : null;
          }
        }
      });
      passNumbers = passNumbers.map((el, ind) => ({
        pass: el,
        ind
      }));
      let newRowsData = [];
      rowsData.forEach((row, index) => {
        if (index !== 0) {
          const newPass = passNumbers.find(el => el.pass === row.pass);
          newRowsData.push({
            ...row,
            pass: newPass.ind.toString(),
          })
        }
      });

      return newRowsData;
    });
};

const convertDataToString = (data, machineID, rollID, rollTempName) => {
  const dataWithoutHeaders = data.slice(1);
  return dataWithoutHeaders
    .map((row, ind) => {
      // (Roll_ID, Roll_temp_name, Position, Thickness, Machine_ID, Time_stamp, Length, Pass)
      return `('${rollID}', '${rollTempName}', ${row.position}, ${String(row.thickness).replace(',','.')}, '${machineID}', '${row.time}', ${String(row.length).replace(',','.')}, ${row.pass})`;
    })
    .join(',\n')
}


const convertDataToArrayOfRequests = (data, machineID, rollID, rollTempName) => {
  const dataWithoutHeaders = data.slice(1);
  if (dataWithoutHeaders.length <= 350) {
    const req = dataWithoutHeaders
    .map((row, ind) => {
      // (Roll_ID, Roll_temp_name, Position, Thickness, Machine_ID, Time_stamp, Length, Pass)
      return `('${rollID}', '${rollTempName}', ${row.position}, ${String(row.thickness).replace(',','.')}, '${machineID}', '${row.time}', ${String(row.length).replace(',','.')}, ${row.pass})`;
    })
    .join(',\n');
    return `insert into Rolls_data\nvalues\n${req};`
  }
  const boundaries = splitDataRecordsToChunks(dataWithoutHeaders);
  const arrayOfRequests = [];
  for (let {start, end} of boundaries) {
    let req = dataWithoutHeaders
      .slice(start,end)    
      .map((row) => {
        // (Roll_ID, Roll_temp_name, Position, Thickness, Machine_ID, Time_stamp, Length, Pass)
        return `('${rollID}', '${rollTempName}', ${row.position}, ${String(row.thickness).replace(',','.')}, '${machineID}', '${row.time}', ${String(row.length).replace(',','.')}, ${row.pass})`;
      })
      .join(',\n');
    req = `insert into Rolls_data\nvalues\n${req};`
    arrayOfRequests.push(req);
  }
  return arrayOfRequests;
}


// const req_str= `insert into Rolls_data 
// values 
// ${dataString};`;

module.exports = {
  readDataFromFile,
  convertDataToString,
  convertDataToArrayOfRequests
};

const fileName = 'Б-38_№_1#2023-06-05 01-14-54_complete.csv';
const machineID = '1250c3fc-945d-11e1-b402-00155d642f01';
const rollID = 'e962805e-e6b8-4924-b161-6ccfa281f3c0';

readDataFromFile(fileName)
  // .then(data => console.log(data))
  // .then(data => {
  //   const req_str = convertDataToString(data, machineID, rollID, fileName);
  //   // console.log(req_str.length);
  //   return req_str;
  // })
  .then(data => {
    const reqArr = convertDataToArrayOfRequests(data, machineID, rollID, fileName);
    return reqArr;
  })
  .then(data => {
    // data.forEach(item => console.log(item.length)); 
    data.forEach(async(item, index) => await fsPromises.writeFile(`${index}.txt`, item));
  })
//   .then(val => console.log(val))
//   .catch(err => {
//     console.log('error happened');
//     console.log(err);
//   });