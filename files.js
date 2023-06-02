const fastcsv = require('fast-csv');

const fsPromises = require('fs/promises');


const readDataFromFile = (filepath) => {
  const rowsData = [];
  // console.log(filepath);
  return fsPromises.readFile(`${filepath}`, { encoding: 'utf8' })
    .then(fastcsv.parse({ headers: true }))
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
      if (data[1].split(';')[3] !== data[2].split(';')[3] ) {
        data = [data[0], ...data.slice(2)];
      }
      data.forEach((element, index) => {
        const [position, thickness,length, pass, time] = element.split(';');
        rowsData.push({position, thickness, length, pass, time});
        if(index !== 0) {
          if (passNumbers.length === 0) {
            passNumbers.push(pass);
          } else {
            passNumbers[passNumbers.length -1] !== pass ? passNumbers.push(pass) : null;
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
  return data
  .slice(1)
  .map((row, ind) => {
      // (Roll_ID, Roll_temp_name, Position, Thickness, Machine_ID, Time_stamp, Length, Pass)
      return `('${rollID}', '${rollTempName}', ${row.position}, ${String(row.thickness).replace(',','.')}, '${machineID}', '${row.time}', ${String(row.length).replace(',','.')}, ${row.pass})`;
  })
  .join(',\n')
}

module.exports = {readDataFromFile, convertDataToString}
// const fileName = 'Б-38_№_1#2023-05-23 05-33-58_complete.csv';
// const machineID = '1250c3fc-945d-11e1-b402-00155d642f01';
// const rollID = 'e962805e-e6b8-4924-b161-6ccfa281f3c0';

// readDataFromFile(fileName)
//   // .then(data => console.log(data))
//   .then(data => {
//     return convertDataToString(data, machineID, rollID, fileName);
//   })
//   .then(val => console.log(val))
//   .catch(err => {
//     console.log('error happened');
//     console.log(err);
//   });