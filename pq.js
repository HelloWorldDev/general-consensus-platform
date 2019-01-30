'use strict';
const FastPriorityQueue = require('fastpriorityqueue');
const uuid = require('uuid/v4');

// calculate time in ms
const eventQ = new FastPriorityQueue((eventA, eventB) => {
    return eventA.tick < eventB.tick;
});
let clock = Date.now();

function run() {
    if (!eventQ.isEmpty()) {
        const event = eventQ.poll();
        clock = event.tick;        
        console.log(clock);
        event.fn();
    }
    setImmediate(run);
}

// generate a new task with random tick
setInterval(() => {
    const genTaskNum = Math.floor(Math.random() * 5);
    for (let j = 0; j < genTaskNum; j++) {
        const tick = Math.floor(Math.random() * 10 + 1);
        const id = uuid();
        const event = {
            fn: () => {
                console.log(`task ${id} is executed`);
            },
            tick: clock + tick
        };
        console.log(`generate task ${id} with tick ${tick}`);
        eventQ.add(event);
    }
    
}, 1000);

run();