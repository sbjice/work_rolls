const { dirname } = require('path');
const appDir = dirname(require.main.filename);
const fastcsv = require('fast-csv');

const fsPromises = require('fs/promises'); // or require('fs/promises') in v10.0.0



const {
    existsSync,
    readFileSync,
    writeFileSync,
    rename,
    createWriteStream,
    writeFile,
    readFile

} = require('fs');

/*
const fastcsv = require('fast-csv');
const fs = require('fs');
const ws = fs.createWriteStream("out.csv");
fastcsv
  .write(data, { headers: true })
  .pipe(ws);
*/

const express = require('express');
const app = express();
const PORT = 3000;
const DB_FILE = process.env.DB_FILE || './db.json';

function createProperTimeName(val) {
    let newTime = val.split('.')[0];
    const valsArr = newTime.split(' ');
    let time = valsArr[1];
    time = time.split(':').join('-');
    return valsArr[0] + ' ' + time;
}

function mapPositionToGivenPoints(position, points =[4905, 4930, 4955, 4980, 5005, 5030, 5055, 5080, 5105, 5130]) {
    for (const point of points) {
        if (position > point - 3 && position < point + 3) return points.indexOf(point)+1;
    }
    return -1;
}


app.use(express.json())

app
    .route('/')
    .get((req, res) => {
        console.log(req.body, req.headers);
        res.json({
            uid: 1,
            name: 'sb_jice'
        });
    })
    .post((req, res) => {
        console.log(req.body, req.headers);
        if (!req.body.roll_id) {
            res.status(500).send(JSON.stringify('no roll_id'));
            return;
        }
        // const stage = req.body.stage; // start, finish, ongoing;
        let { roll_id, stage, time, thickness, position } = req.body;
        roll_id = createProperTimeName(roll_id);
        const objToWrite = { time, position, thickness };
        const fileName = appDir + '\\reports\\' + `${roll_id}_write.json`;
        if (stage === 'start') {
            console.log(fileName);
            if (existsSync(fileName)) {
                res.status(500).send(JSON.stringify('file exists'));
                return;
            }
            writeFileSync(fileName, 
                JSON.stringify([objToWrite]), 
                { encoding: 'utf8' }, function(err) {
                    if ( err ) console.log('ERROR: ' + err);
                });
            res.status(200).send(JSON.stringify('created and written successfully'));
        } else if (stage === 'ongoing') {
            if (!existsSync(fileName)) {
                res.status(500).send(JSON.stringify('file does not exist'));
                return;
            }
            const content = readFileSync(fileName, { encoding: 'utf8' }, function(err) {
                if ( err ) console.log('ERROR: ' + err);
            });
            const records = JSON.parse(content || '[]');

            writeFileSync(fileName, 
                JSON.stringify([ ...records, objToWrite]), 
                { encoding: 'utf8' }, function(err) {
                    if ( err ) console.log('ERROR: ' + err);
                });
            res.status(200).send(JSON.stringify('written again successfully'));

        } else {
            if(existsSync(`${roll_id}_complete.json`)) {
                res.status(500).send(JSON.stringify('file already complete, cannot write anymore'));
                return;
            } else if (!existsSync(fileName)) {
                res.status(500).send(JSON.stringify('file does not exist'));
                return;
            } else {
                const content = readFileSync(fileName, { encoding: 'utf8' }, function(err) {
                    if ( err ) console.log('ERROR: ' + err);
                });
                const records = JSON.parse(content || '[]');
                let newFileNameJSON = appDir + '\\reports\\' + `${roll_id}_complete.json`;
                let newFileNameCSV = appDir + '\\reports\\' + `${roll_id}_complete.csv`;
    
                fsPromises.writeFile(fileName, 
                    JSON.stringify([ ...records, objToWrite]), 
                    { encoding: 'utf8' })
                .then(() => {
                    return fsPromises.rename(fileName, newFileNameJSON);
                })
                // .then(() => {
                //     console.log('file exists', existsSync(newFileNameJSON));
                // })
                .catch(er => {
                    console.log('error after rename');
                    console.log(er);
                })
                .then(() => {
                    const fileContent = fsPromises.readFile(newFileNameJSON, { encoding: 'utf8' });
                    return fileContent;
                })
                .catch(er => {
                    console.log('error after read');
                    console.log(er);
                })
                .then((fileContent) => {
                    // console.log(fileContent);
                    let fileData = JSON.parse(fileContent);
    
                    let newfileData = fileData.map(item => {
                        item.position = mapPositionToGivenPoints(parseInt(item.position));
                        item.thickness = Math.round(parseFloat(item.thickness) * 100) / 100;
                        item.thickness = String(item.thickness).split('.').join(',');
                        return {
                            position: item.position,
                            thickness: item.thickness
                        }
                    });
    
                    const ws = createWriteStream(newFileNameCSV);
    
                    fastcsv
                        .write(newfileData, { headers: true, delimiter: ';' })
                        .pipe(ws);
                })
                .catch(er => {
                    console.log(er);
                });

                res.status(200).send(JSON.stringify('written again and renamed file successfully'));
            }

        }
    });

app.listen(PORT, () => console.log(`server started on PORT ${PORT}`));