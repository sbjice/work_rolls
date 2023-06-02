const sql = require('mssql');
const path = require('path');
const { convertDataToString, readDataFromFile } = require('./files');

const sqlConfig = {
    user: 'SB',
    password: 'Zxc123456',
    database: 'RollsThickness',
    server: 'hdois260',
    pool: {
        max: 15,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        trustServerCertificate: true // change to true for local dev / self-signed certs
    }
}
const rollStates = {
    start: 1,
    ongoing: 2,
    complete: 3,
    error: 4,
    cancelled: 5
};

const machines = {
    'Б-38_№_1': '1250c3fc-945d-11e1-b402-00155d642f01',
    'БДМ_№_34': '3df32c89-b104-11e8-8497-00155d642f01',
    'Б-38_№_2': '6fddaac1-a64b-11e1-b402-00155d642f01',
    'БДМ_№_4': '77de47cb-9984-11e5-8342-00155d642f01',
    'БС-2_№_6': '7ac147e4-2e3c-11e2-a554-00155d642f01',
    'БС-2_№_7': '7ac147e5-2e3c-11e2-a554-00155d642f01',
    'БС-2_№_8': '7ac147e6-2e3c-11e2-a554-00155d642f01',
    'БДМ_№_56': '99bf0ef9-ba15-11e7-a763-00155d642f01',
    'БДМ_№_5': 'a787c8a2-764f-11e5-8341-00155d642f01',
    'БДМ_№_10': 'c9385cad-a709-11ea-b8f8-00155d642f01',
    'БДМ_№_3': 'dc5d9f81-8af5-11e6-a429-00155d642f01'
}

// sql.on('error', err => {
//     // ... error handler
//     console.log('Error happened!');
//     console.log('Error data:', err);
// })

// sql.connect(sqlConfig).then(pool => {

//     return pool.request()
//         .query('select * from Machines')
//         .then(result => {
//             console.log(result);
//         })
//         .then(() => pool.close());
// }).catch(err => {
//     console.log('Error happened!');
//     console.log('Error data:', err);
// });

const getTargetRecord = (sql, sqlConfig, machineID) => {
    return new Promise((resolve, reject) => {
        sql.on('error', err => {
            reject(err);
        })

        sql.connect(sqlConfig).then(pool => {

            return pool.request()
                .query(`
              select top 1 * from Rolls_state 
              where Machine_id = '${machineID}' and Current_state not in (3,4,5) 
              order by Time_stamp desc;`)
                .then(result => {
                    pool.close();
                    resolve(result.recordset[0]);
                })
                .catch(err => {
                    pool.close();
                    reject(err);
                });
        }).catch(err => {
            reject(err);
        });
    })
};

// getTargetRecord(sql, sqlConfig, machines['Б-38 № 1'])
//     .then(res => console.log(res))
//     .catch(err => console.log('error happened: \n', err));
/*
    returns
    {
        Record_ID: 3,
        Machine_ID: '1250c3fc-945d-11e1-b402-00155d642f01',
        Roll_ID: 'd9a66fe4-6257-48a9-afed-44fc682e4844',
        Roll_temp_name: '-',
        Current_state: 1,
        Time_stamp: 2023-04-26T11:42:26.500Z
    }
*/




const insertNewRecord = (sql, sqlConfig, machineID, rollName) => {
    return new Promise((resolve, reject) => {
        sql.on('error', err => {
            reject(err);
        })

        sql.connect(sqlConfig).then(pool => {
            return pool.request()
                .query(`
            insert into 
            Rolls_state (Machine_ID, Roll_temp_name, Current_state, Time_stamp) 
            values ('${machineID}', '${rollName}', 1, CURRENT_TIMESTAMP);`)
                .then(result => {
                    pool.close();
                    resolve(result);
                })
                .catch(err => {
                    pool.close();
                    reject(err);
                });
        }).catch(err => {
            reject(err);
        });
    })
};

// insertNewRecord(sql, sqlConfig, machines['Б-38 № 1'], new Date().toTimeString())
//     .then(res => console.log(res))
//     .catch(err => console.log('error happened: \n', err));



const updateExistingRecord = (sql, sqlConfig, machineID, newState) => {
    return new Promise((resolve, reject) => {
        sql.on('error', err => {
            reject(err);
        })

        let roll_name = 0;
        getTargetRecord(sql, sqlConfig, machineID)
            .then(res => {
                if (!res) reject('no data fetched');
                roll_name = res.Roll_temp_name;
            })
            .catch(err => reject(err))
            .then(() => {
                sql.connect(sqlConfig).then(pool => {
                    return pool.request()
                        .query(`
                          update Rolls_state 
                          set Current_state = ${newState}, Time_stamp = CURRENT_TIMESTAMP 
                          where Roll_temp_name = '${roll_name}';`)
                        .then(result => {
                            pool.close();
                            resolve(result);
                        })
                        .catch(err => {
                            pool.close();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
            })

    })
};


// updateExistingRecord(sql, sqlConfig, machines['Б-38 № 1'], rollStates['start'])
//   .then(res => console.log(res))
//   .catch(err => console.log('error happened: \n', err));


// machineID, rollID, rollTempName
// data

const sendDataByTransaction = (sql, sqlConfig, machineID, rollID, filename, rollTempName) => {

    return new Promise((resolve, reject) => {

        sql.on('error', err => {
            reject(err);
        });

        sql.connect(sqlConfig).then(pool => {

            const transaction = new sql.Transaction(pool);
            transaction.begin(err => {
                if (err) reject(err);

                transaction.commit(err => {
                    if (err) reject(err);
                    return readDataFromFile(filename)
                        .then(data => {
                          if (data.length >= 401){
                            return convertDataToString(data, machineID, rollID, rollTempName);
                          } else {
                            pool.close();
                            reject('file too small');
                          }
                        })
                        .catch(err => {
                            pool.close();
                            reject(err);
                        })
                        .then(dataString => {
                            //                             (Roll_ID, Roll_temp_name, Position, Thickness, Machine_ID, Time_stamp, Length, Pass)

                            const req_str= `insert into Rolls_data 
                            values 
                            ${dataString};`;
                            // const ps = new sql.PreparedStatement(pool);
                            console.log(req_str);
                            return pool.request()
                                .query(req_str)
                        })
                        .then(result => {
                            pool.close();
                            resolve(result);
                        })
                        .catch(err => {
                            pool.close();
                            reject(err);
                        });
                });
            });
        });
    });
}


const rollID = 'e962805e-e6b8-4924-b161-6ccfa281f3c0';
const fileName = 'Б-38_№_1#2023-05-23 05-33-58_complete.csv';

const appDir = 'C:\\SCADA Projects\\Reports\\БДМ1';
// path.join(appDir, `${roll_id}_write.json`)
// const fileName = 'C:\\SCADA Projects\\Reports\\БДМ1\\Б-38_№_1#2023-05-26 08-46-15_complete.csv';

// sendDataByTransaction(sql, sqlConfig, machines['Б-38_№_1'], rollID, appDir, fileName)
//     .then(res => console.log(res))
//     .catch(err => console.log('error happened: \n', err));

module.exports = {
    sql,
    sqlConfig,
    rollStates,
    machines,
    getTargetRecord,
    insertNewRecord,
    updateExistingRecord,
    sendDataByTransaction,
}