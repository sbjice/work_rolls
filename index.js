const {
    existsSync,
    readFileSync,
    writeFileSync,
    rename,
} = require('fs');


const express = require('express');
const app = express();
const PORT = 3000;
const DB_FILE = process.env.DB_FILE || './db.json';


app.use(express.json())

app
    .route('/')
    .get((req, res) => {
        res.json({
            uid: 1,
            name: 'sb_jice'
        });
    })
    .post((req, res) => {
        console.log(req.body);
        if (!req.body.roll_id) {
            res.status(500).send(JSON.stringify('no roll_id'));
            return;
        }
        // const stage = req.body.stage; // start, finish, ongoing;
        const { roll_id, stage, time, thickness, position } = req.body;
        const objToWrite = { time, position, thickness };
        const fileName = `${roll_id}_write.json`;
        if (stage === 'start') {
            if (existsSync(fileName)) {
                res.status(500).send(JSON.stringify('file exists'));
                return
            }
            writeFileSync(fileName, 
                JSON.stringify([objToWrite]), 
                { encoding: 'utf8' }, function(err) {
                    if ( err ) console.log('ERROR: ' + err);
                });
            res.status(200).send(JSON.stringify('created and written successfully'));
        } else if (stage === 'ongoing') {
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
            }
            const content = readFileSync(fileName, { encoding: 'utf8' }, function(err) {
                if ( err ) console.log('ERROR: ' + err);
            });
            const records = JSON.parse(content || '[]');

            writeFileSync(fileName, 
                JSON.stringify([ ...records, objToWrite]), 
                { encoding: 'utf8' });
            rename(fileName, `${roll_id}_complete.json`, function(err) {
                if ( err ) console.log('ERROR: ' + err);
            });
            res.status(200).send(JSON.stringify('written again and renamed file successfully'));
        }
    });

app.listen(PORT, () => console.log(`server started on PORT ${PORT}`));