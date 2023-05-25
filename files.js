const fastcsv = require('fast-csv');

const fsPromises = require('fs/promises');


const readDataFromFile = (filepath) => {
  const rowsData = [];
  return fsPromises.readFile(filepath, { encoding: 'utf8' })
    .then(fastcsv.parse({ headers: true }))
    .catch(error => {
      return error;
    })
    .then(data => {
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

module.exports = {readDataFromFile}

readDataFromFile('./Б-38_№_1#2023-05-23 05-33-58_complete.csv')
  .then(data => console.log(data))
  .catch(err => {
    console.log('error happened');
    console.log(err);
  });