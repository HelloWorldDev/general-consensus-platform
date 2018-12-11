const CLI = require('clui');
const CLC = require('cli-color');
const config = require('../config');
const Line = CLI.Line;

class Dashboard {

    update() {
        CLI.Clear();
        let header = undefined;
        for (let nodeID in this.infos) {
            if (nodeID === 'attacker' || nodeID === 'system') {
                continue;
            }
            const info = this.infos[nodeID];
            if (!header) {
                header = new Line().column('nodeID', 20);
                for (let attr in info) {
                    header.column(attr, info[attr].w);
                }
                header.fill().output();
            }
            let row = new Line();
            if (nodeID <= config.nodeNum - config.byzantineNodeNum) {
                row.column(nodeID, 20);
            }
            else {
                row.column(nodeID, 20, [CLC.red]);
            }
            for (let attr in info) {
                row.column(info[attr].s, info[attr].w);
            }
            row.fill().output();
        }
        // ======
        // attacker state
        new Line().column('='.repeat(150), 150).fill().output();
        if (this.infos.attacker !== undefined) {
            this.infos.attacker.forEach(info => {
                new Line().column(info, 150).fill().output();
            });
        }
        // ======
        // attacker state
        new Line().column('='.repeat(150), 150).fill().output();
        if (this.infos.system !== undefined) {
            this.infos.system.forEach(info => {
                new Line().column(info, 150).fill().output();
            });
        }
    }

    constructor(infos) {
        this.infos = infos;
    }
}

module.exports = Dashboard;

/*
    clear = CLI.Clear,
    clc   = require('cli-color');

var Line          = CLI.Line;
    Progress      = CLI.Progress;

var statuses = [0, 0, 0, 0, 0];
var lengths = [10, 20, 30, 40, 50];
var percent = 0

console.log('\nCtrl/Command + C to quit...\n\n\n\n\n\n\n\n\n');

function drawProgress () {
  clear()

  var blankLine = new Line().fill().output();

  var headers = new Line()
    .padding(2)
    .column('Item', 20, [clc.cyan])
    .column('Progress', 40, [clc.cyan])
    .fill()
    .output();

  blankLine.output();

  for(var index in lengths) {
    var thisProgressBar = new Progress(20);

    var websiteLine = new Line()
      .padding(2)
      .column('Item #' + index, 20, [clc.cyan])
      .column(thisProgressBar.update(statuses[index], lengths[index]), 40)
      .fill()
      .output();
  }

  var thisPercentBar = new Progress(20);
  var percentLine = new Line()
    .padding(2)
    .column('Item %', 20, [clc.yellow])
    .column(thisPercentBar.update(percent), 40)
    .fill()
    .output()

  blankLine.output();
}

var statusTimer = setInterval(drawProgress, 100);
var incrementTimer = setInterval(function () {
  for(var index in lengths)
  {
    if (statuses[index] < lengths[index])
      statuses[index]++;
  }
  if (percent <= 1) {
    percent += 0.02
  }
}, 500);
*/
