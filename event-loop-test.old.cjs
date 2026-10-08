const fs = require('node:fs')

const start = Date.now();
const secondTest = () => {
    console.log(`Second Test START on ${new Date()}`);

    setTimeout(() => {
        const delay = Date.now() - start;
        console.log(`Timeout done at ${delay}ms`);
    }, 0);

    setImmediate(() => {
        const delay = Date.now() - start;
        console.log(`Immediate done at ${delay}ms`);
    });

    process.nextTick(() => {
        const delay = Date.now() - start;
        console.log(`nextTick done at ${delay}ms`);
    })

    Promise.resolve().then(() => {
        const delay = Date.now() - start;
        console.log(`Resolved Promise done at ${delay}ms`);
    });
};

const secondTestFs = () => {
    console.log(`Second Test within an I/O cycle START on ${new Date()}`);
    fs.readFile('./lorem-100mb.json', ()  => {
        setTimeout(() => {
            const delay = Date.now() - start;
            console.log(`Timeout (I/O) done at ${delay}ms`);
        }, 0);

        setImmediate(() => {
            const delay = Date.now() - start;
            console.log(`Immediate (I/O) done at ${delay}ms`);
        });

        process.nextTick(() => {
            const delay = Date.now() - start;
            console.log(`nextTick (I/O) done at ${delay}ms`);
        })

        Promise.resolve().then(() => {
            const delay = Date.now() - start;
            console.log(`Resolved Promise (I/O) done at ${delay}ms`);
        });
    })
};
secondTest();
secondTestFs();