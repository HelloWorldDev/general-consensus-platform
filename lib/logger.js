'use strict';

const fs = require('fs');
const moment = require('moment');
const { exec } = require('child_process');

class Logger {

    write(line) {
        fs.appendFile(`${Logger.dir}/${this.nodeID}.log`, 
            line + '\n', 
            (err) => {
                if (err) {
                    console.log(err);
                }
            }
        );
    }

    clearFile() {
        if (!fs.existsSync(Logger.dir)) {
            if (fs.mkdirSync(Logger.dir) === undefined) {
                console.log('Log directory has already been created.');
            }
        }
        fs.writeFile(this.fileName, '', (err) => {
            if (err) {
                console.log(err);
            }
        });
    }

    logMsg(level, msgArr) {
		let msg = `[${level}] `;
		// add timestamp
		// always print +8 timezone
		//const offset = 8;
		//const now = new Date(new Date().getTime() + offset * 3600 * 1000)
            //.toUTCString().replace(/ GMT$/, '');
        const now = moment().format('hh:mm:ss');
		msg += '[' + now + '] ';
		for (let i = 0; i < msgArr.length - 1; i++)
			msg += '[' + msgArr[i] + '] ';
		msg += msgArr[msgArr.length - 1];
        //console.log(msg);
        this.write(msg);
    }
    
	info(msgArr) {
		this.logMsg('info', msgArr);
    }
    
	warning(msgArr) {
		this.logMsg('warning', msgArr);
    }
    
	error(msgArr) {
		this.logMsg('error', msgArr);
    }

    constructor(nodeID) {
        this.nodeID = nodeID;
        this.fileName = `${Logger.dir}/${this.nodeID}.log`;
        this.clearFile();
    }

    static removeLogDir() {
        exec('rm -rf ./log');
    }
}
Logger.dir = './log';
module.exports = Logger;