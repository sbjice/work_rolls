const { dirname } = require('path');
const appDir = dirname(require.main.filename);
const fastcsv = require('fast-csv');


const {
    existsSync,
    readFileSync,
    writeFileSync,
    rename,
    createWriteStream
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

function mapPositionToGivenPoints(position, points =[4905, 4930, 4955, 4980, 5005,
                                                    5030, 5055, 5080, 5105, 5130]) {
    for (let point of points) {
        if (position < point || position > point) return points.indexOf(point);
    }
    return 0;
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
    
                writeFileSync(fileName, 
                    JSON.stringify([ ...records, objToWrite]), 
                    { encoding: 'utf8' });
                rename(fileName, newFileName, function(err) {
                    if ( err ) console.log('ERROR: ' + err);
                });

                const fileContent = readFileSync(newFileNameJSON, { encoding: 'utf8' }, function(err) {
                    if ( err ) console.log('ERROR: ' + err);
                });
                let fileData = JSON.parse(fileContent);

                fileData.forEach(item => {
                    item.position = mapPositionToGivenPoints(parseInt(item.position));
                    item.thickness = Math.round(parseFloat(item.thickness)* 100) / 100;
                });

                const ws = createWriteStream(newFileNameCSV);

                fastcsv
                    .write(fileData, { headers: true })
                    .pipe(ws);

                res.status(200).send(JSON.stringify('written again and renamed file successfully'));
            }

        }
    });

app.listen(PORT, () => console.log(`server started on PORT ${PORT}`));