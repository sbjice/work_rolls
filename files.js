const fastcsv = require('fast-csv');

const fsPromises = require('fs/promises');


export const readDataFromFile = (filepath) => {
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
      data.forEach(element => {
        const [position, thickness, time] = element.split(';');
        rowsData.push({position, thickness, time});
      });
      return rowsData;
    });
};

// readDataFromFile('./2023-05-13 14-43-23_complete.csv')
//   .then(data => console.log(data))
//   .catch(err => {
//     console.log('error happened');
//     console.log(err);
//   });