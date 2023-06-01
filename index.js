const {
    dirname
} = require('path');
const path = require('path');
// const appDir = dirname(require.main.filename);
const appDir = 'C:\\SCADA Projects\\Reports\\БДМ1';
// const appDir1 = dirname(require.main.filename);
// console.log('appdir is   ',appDir1);

import {
    sql,
    sqlConfig,
    rollStates,
    machines,
    getTargetRecord,
    insertNewRecord,
    updateExistingRecord,
    sendDataByTransaction,
} from './db';


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

// function mapPositionToGivenPoints(position, points =[4905, 4930, 4955, 4980, 5005, 5030, 5055, 5080, 5105, 5130]) {
//     for (const point of points) {
//         if (position >= point - 10 && position <= point + 10) return points.indexOf(point) + 1;
//     }
//     return -1;
// }

function mapPositionToGivenPoints(position, points = [4905, 4930, 4955, 4980, 5005,
    5030, 5055, 5080, 5105, 5130
]) {
    let minDistance = 200; // necessarily big value
    for (const point of points) {
        const distance = Math.abs(position - point);
        if (distance < minDistance) minDistance = distance;
    }
    for (const point of points) {
        const distance = Math.abs(position - point);
        if (distance === minDistance) return points.indexOf(point) + 1;
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
        // console.log('appdir is   ',appDir);

        if (!req.body.roll_id) {
            res.status(500).send(JSON.stringify('no roll_id'));
            return;
        }
        // const stage = req.body.stage; // start, finish, ongoing;
        let {
            roll_id,
            stage,
            time,
            thickness,
            position,
            length,
            pass
        } = req.body;
        roll_id = createProperTimeName(roll_id);
        const objToWrite = {
            time,
            position,
            thickness,
            length,
            pass
        };
        // const fileName = appDir + '\\reports\\' + `${roll_id}_write.json`;
        const fileName = path.join(appDir, `${roll_id}_write.json`);
        // console.log(fileName);
        const machineName = roll_id.split('#')[0];

        if (stage === 'start') {
            console.log(fileName);
            if (existsSync(fileName)) {
                res.status(500).send(JSON.stringify('file exists'));
                return;
            }
            writeFileSync(fileName,
                JSON.stringify([objToWrite]), {
                    encoding: 'utf8'
                },
                function (err) {
                    if (err) console.log('ERROR: ' + err);
                });
            // проверка целевой записи
            // создание новой целевой записи в бд (внутри ф-ии по дефолту ставится состояние 1 - старт)
            getTargetRecord(sql, sqlConfig, machines[machineName])
                .then(res => {
                    if (res.Current_state === 2) {
                        updateExistingRecord(sql, sqlConfig, machines[machineName], rollStates['start'])
                            .catch(err => {
                                console.log('error happened on target record update!');
                                console.log(err);
                            });
                    } else if (res.Current_state !== 2) {
                        insertNewRecord(sql, sqlConfig, machines[machineName], roll_id)
                            .catch(err => {
                                console.log('error happened on new target record insert!');
                                console.log(err);
                            });
                        // еще здесь предполагалось добавить проверку по времени предыдущей вставки целевой записи
                        // чтобы можно было перевести эту целевую запись в состояние 'cancelled'
                    } 
                })
                .catch(err => {
                    console.log('error happened on target record get or update!');
                    console.log(err);
                });

            res.status(200).send(JSON.stringify('created and written successfully'));
        } else if (stage === 'ongoing') {
            if (!existsSync(fileName)) {
                res.status(500).send(JSON.stringify('file does not exist'));
                return;
            }
            const content = readFileSync(fileName, {
                encoding: 'utf8'
            }, function (err) {
                if (err) console.log('ERROR: ' + err);
            });
            const records = JSON.parse(content || '[]');

            writeFileSync(fileName,
                JSON.stringify([...records, objToWrite]), {
                    encoding: 'utf8'
                },
                function (err) {
                    if (err) console.log('ERROR: ' + err);
                });

            res.status(200).send(JSON.stringify('written again successfully'));
        } else {
            if (existsSync(`${roll_id}_complete.json`)) {
                res.status(500).send(JSON.stringify('file already complete, cannot write anymore'));
                return;
            } else if (!existsSync(fileName)) {
                res.status(500).send(JSON.stringify('file does not exist'));
                return;
            } else {
                const content = readFileSync(fileName, {
                    encoding: 'utf8'
                }, function (err) {
                    if (err) console.log('ERROR: ' + err);
                });
                const records = JSON.parse(content || '[]');
                // let newFileNameJSON = appDir + '\\reports\\' + `${roll_id}_complete.json`;
                // let newFileNameCSV = appDir + '\\reports\\' + `${roll_id}_complete.csv`;

                let newFileNameJSON = path.join(appDir, `${roll_id}_complete.json`);
                let newFileNameCSV = path.join(appDir, `${roll_id}_complete.csv`);
                fsPromises.writeFile(fileName,
                        JSON.stringify([...records, objToWrite]), {
                            encoding: 'utf8'
                        })
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
                        const fileContent = fsPromises.readFile(newFileNameJSON, {
                            encoding: 'utf8'
                        });
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
                            item.length = Math.round(parseFloat(item.length) * 100) / 100;
                            item.length = String(item.length).split('.').join(',');
                            return {
                                position: item.position,
                                thickness: item.thickness,
                                length: item.length,
                                pass: item.pass,
                                time: item.time,
                            }
                        });

                        const ws = createWriteStream(newFileNameCSV);

                        fastcsv
                            .write(newfileData, {
                                headers: true,
                                delimiter: ';'
                            })
                            .pipe(ws);
                    })
                    .then(() => {
                        return getTargetRecord(sql, sqlConfig, machines[machineName]);
                    })
                    .then((targetRecordData) => {
                        const Roll_ID = targetRecordData.Roll_ID;
                        return sendDataByTransaction(sql, sqlConfig, machines[machineName], Roll_ID, appDir, roll_id);
                    })
                    .catch(err => {
                        console.log(err);
                    });

                res.status(200).send(JSON.stringify('written again and renamed file successfully'));
            }

        }
    });

app.listen(PORT, () => console.log(`server started on PORT ${PORT}`));