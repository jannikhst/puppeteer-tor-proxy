import puppeteer from 'puppeteer-extra';
import Stealth from 'puppeteer-extra-plugin-stealth';
import AdBlock from 'puppeteer-extra-plugin-adblocker';
import Anon from 'puppeteer-extra-plugin-anonymize-ua';
import useProxy from 'puppeteer-page-proxy';
import { performAction, wait } from './action';
import { Browser, Page } from 'puppeteer';
import { IpWorker, blockIPForOthers, unblockIPForOthers } from './ip_worker';
import fs from 'fs/promises';
import axios from 'axios';
puppeteer.use(Anon());
puppeteer.use(Stealth());
puppeteer.use(AdBlock());

export interface Stats {
    totalVotes: number;
    totalAttempts: number;
}

const stats: Stats = {
    totalVotes: 0,
    totalAttempts: 0,
};
const headless: boolean = process.env.RUN_HEADLESS === 'true';
const ipWorker = new IpWorker();

let workerCount = 2;
let browserCount = 1;
let currentlyOpenbrowsers = 0;
let useOwnIp = false;
let ownIp: string | undefined = undefined;
let stickToIp: boolean = false;

process.on('unhandledRejection', async (error) => {
    console.log(error);
    await wait(3000);
    console.log('checking browser count...');
    console.log(`Currently ${currentlyOpenbrowsers} browsers open`);
    if (currentlyOpenbrowsers < browserCount) {
        console.log('Restarting browser...');
        startBrowser();
    }
});




async function main() {
    await fs.readFile('./worker.config', 'utf-8').then((data) => {
        const lines = data.split('\n');
        for (const line of lines) {
            const fragments = line.split('=');
            if (fragments.length === 2) {
                const key = fragments[0].trim();
                const value = fragments[1].trim();
                if (key === 'browsers') {
                    browserCount = parseInt(value);
                } else if (key === 'workers') {
                    workerCount = parseInt(value);
                } else if (key === 'useOwnIp') {
                    useOwnIp = value === 'y';
                } else if (key === 'stickToIp') {
                    stickToIp = value === 'y';
                }
            }
        }
    }).catch((error) => {
        console.log(error);
    });

    if (useOwnIp) {
        const res = await axios.get('http://ip-api.com/json/');
        ownIp = res.data.query;
        console.log(`also using own ip: ${ownIp}`);
    }

    const totalStartTime = Date.now();
    for (let i = 0; i < browserCount; i++) {
        startBrowser();
        await wait(15000);
    }
    while (true) {
        await wait(15000);
        printVotesPerMinute(stats, totalStartTime);
    }
}

async function startBrowser() {
    try {
        await executeBrowser();
    } catch (error) {
        currentlyOpenbrowsers--;
    }
    startBrowser();
}


async function executeBrowser(): Promise<void> {
    const browser = await buildBrowser();
    currentlyOpenbrowsers++;
    try {
        const times: number[] = [];
        while (true) {
            console.log('---------------------------------');
            const start = Date.now();
            await execute(browser);
            const end = Date.now();
            times.push(end - start);
            console.log(`Took ${end - start}ms for iteration`);
            if (times.length > 30) {
                times.shift();
            }
            const avg = times.reduce((a, b) => a + b, 0) / times.length;
            console.log(`Average: ${Math.round(avg / 1000)}s`);
            const totalVotes = stats.totalVotes;
            const totalAttempts = stats.totalAttempts;
            const quota = totalVotes / totalAttempts;
            // in percent
            console.log(`total votes: ${totalVotes}`);
            console.log(`total attempts: ${totalAttempts}`);
            console.log(`success rate: ${Math.round(quota * 100)}%`);
            console.log('---------------------------------\n\n');
        }
    } catch (error) {
        console.log(error);
        await browser.close();
        await wait(8000);
        console.log('Restarting browser');
    }
}

function printVotesPerMinute(stats: Stats, start: number) {
    const { totalVotes } = stats;
    const end = Date.now();
    const votesPerMin = totalVotes / ((end - start) / 1000 / 60);
    const roundWithOneDecimal = Math.round(votesPerMin * 10) / 10;
    console.log(`Current votes per minute: ${roundWithOneDecimal}`);
}


export async function buildBrowser(): Promise<Browser> {
    const options = { width: 1920 * 0.8, height: 1080 * 0.8 };
    const browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: [
            `--window-size=${options.width},${options.height}`,
            '--no-sandbox',
        ],
    });
    return browser;
}

async function execute(browser: Browser): Promise<void> {
    const concurrentWorkes = workerCount;
    const promises: Promise<void>[] = [];
    for (let i = 0; i < concurrentWorkes; i++) {
        promises.push(startPage(browser));
    }
    await Promise.all(promises);
}

main().catch(console.error);


async function startPage(browser: Browser): Promise<void> {
    const page = await browser.newPage();
    try {
        const tor = await ipWorker.getUnusedInstance(58000, ownIp);
        if (!tor.isMocked) {
            await useProxy(page, tor.proxyUrl);
        } else {
            console.log('using own ip now');
        }
        // if performAction takes longer than 3 minutes, abort
        try {
            await performAction(page, false, tor.info.ip, stats);
        } catch (error) {
            console.log('❌  Aborting action');
        }
        try {
            await page.close();
        } catch (error) {
        }
    } catch (error) {
        console.log(error);
    }
}


