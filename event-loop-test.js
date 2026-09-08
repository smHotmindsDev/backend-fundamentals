import * as fs from 'node:fs';
const firstTest = () => new Promise(resolve => {
    const start = Date.now();
    console.log(`First Test START on ${new Date()}`);

    Promise.allSettled([
        fetch('http://127.0.0.1:8000/json-parse-100mb').then(() =>
            console.log(`json-parse done at +${Date.now() - start}ms`)
        ),
        fetch('http://127.0.0.1:8000/await-timer').then(() =>
            console.log(`await-timer done at +${Date.now() - start}ms`)
        ),
    ]).then(() => {
        console.log(`First Test FINISH on ${new Date()}, duration = ${Date.now() - start}ms`);
        resolve();
    });
});

const secondTest = () => new Promise(resolve => {
    const start = Date.now();
    console.log(`Second Test START on ${new Date()}`);

    const timeoutP = new Promise(resolve => {
        setTimeout(() => {
            const delay = Date.now() - start;
            console.log(`Timeout done at ${delay}ms`);
            resolve();
        }, 0);
    });

    const immediateP = new Promise(resolve => {
        setImmediate(() => {
            const delay = Date.now() - start;
            console.log(`Immediate done at ${delay}ms`);
            resolve();
        });
    })

    const nextTickP = new Promise(resolve => {
        process.nextTick(() => {
            const delay = Date.now() - start;
            console.log(`nextTick done at ${delay}ms`);
            resolve();
        })
    })

    const resolvedPromiseP = new Promise(resolve => {
        Promise.resolve().then(() => {
            const delay = Date.now() - start;
            console.log(`Resolved Promise done at ${delay}ms`);
            resolve();
        });
    })

    Promise.allSettled([
        timeoutP,
        immediateP,
        nextTickP,
        resolvedPromiseP
    ]).then(() => {
        const finish = Date.now()
        console.log(`Second Test FINISH on ${new Date()}, duration = ${finish - start}ms`);
        resolve();
    })
})

const secondTestFs = () => new Promise(resolve => {
    const start = Date.now();
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
            resolve();
        });
    })
});

// 3. Read a big file with `readFileSync` vs streams inside a request handler; measure impact on other requests.

const thirtyTest = () => new Promise(resolve => {
    const start = Date.now();
    console.log(`Thirty Test START on ${new Date()}`);
    const readSyncP = () => new Promise(resolve => {
        const readSyncStart = Date.now();
        console.log(`read-sync start at ${Date.now()}ms`);

        Promise.allSettled([
            fetch('http://127.0.0.1:8000/read-sync').then(() =>
                console.log(`read-sync done at +${Date.now() - readSyncStart}ms`)
            ),
            fetch('http://127.0.0.1:8000/').then(() =>
                console.log(`get on homepage parallel with read-sync done at +${Date.now() - readSyncStart}ms`)
            )
        ]).then(() => resolve());
    })

    const readStreamP = () => new Promise(resolve => {
        const readStreamStart = Date.now();
        console.log(`read-stream start at ${Date.now()}ms`);

        Promise.allSettled([
            fetch('http://127.0.0.1:8000/read-stream').then(() =>
                console.log(`read-stream done at +${Date.now() - readStreamStart}ms`)
            ),
            fetch('http://127.0.0.1:8000/').then(() =>
                console.log(`get on homepage parallel with read-stream done at +${Date.now() - readStreamStart}ms`)
            )
        ]).then(() => resolve());
    })

    async function runThirtyTest() {
        await readSyncP();
        await readStreamP();
        console.log(`Thirty Test FINISH on ${new Date()}, duration = ${Date.now() - start}ms`);
        resolve();
    }

    runThirtyTest()
});
async function runAll() {
    // await firstTest();
    // await secondTest();
    // await secondTestFs();
    await thirtyTest();
    console.log('All tests done');
}

runAll();