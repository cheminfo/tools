'use strict';

let x = 0;

class A {
    constructor() {
        console.log(x);
    }
}

const y = [0, 1];
for (let i of y) {
    console.log(i);
}

let [, a] = y;

module.exports = A;
