import axios from "axios";
import { wait } from "./action";
import { MockedTorInstance, TorConfig, TorInstance } from "./tor";

export class IpWorker {
    private torInstances: { [key: string]: TorInstance } = {};

    async createInstance(): Promise<TorInstance> {
        console.log('🛜  Creating tor instance...');
        const config: TorConfig = {
            ExitNodes: ['de'],
            StrictNodes: true,
        };
        const temporaryWaitlist: TorInstance[] = [];
        const geoIssues = await getGeoIssues();
        while (true) {
            const tor = await TorInstance.create(config);
            // check if instance already exists
            const endpoint = tor.info.ip;
            console.log(`🤖  Created tor instance ${tor.info.info}`);
            if (this.torInstances[endpoint] || geoIssues.includes(endpoint)) {
                console.log('🟡  Had issues with this IP before, switching...');
                await tor.close();
                console.log('🟡  Closed instance:', tor.info.ip);
                await wait(200);
                continue;
            }
            this.torInstances[endpoint] = tor;
            await registerIp(endpoint);

            console.log(`🟢  Checking waitlist... (${temporaryWaitlist.length} instances)`);
            for (const instance of temporaryWaitlist) {
                const check = await checkIfNewTorInstanceIsUsedBySomeoneElse(instance.info.ip, 55000);
                if (!check) {
                    console.log(`🟢  Found unused IP in waitlist: ${instance.info.ip}`);
                    return instance;
                }
            }
            const check = await checkIfNewTorInstanceIsUsedBySomeoneElse(endpoint, 55000);
            if (check) {
                temporaryWaitlist.push(tor);
                console.log(`🟡  Someone else is using this IP, but we keep it open for later...`);
                continue;
            }
            return tor;
        }
    }

    async prepareConnections(count: number): Promise<void> {
        console.log(`🟢  Preparing ${count} connections...`);
        const tasks: Promise<any>[] = [];
        for (let i = 0; i < count; i++) {
            tasks.push(this.createInstance());
        }
        await Promise.all(tasks);
        console.log(`🟢  Prepared ${count} connections.`);
    }

    async closeInstance(endpoint: string): Promise<void> {
        console.log(`🟠 Closing tor instance ${endpoint}`);
        const tor = this.torInstances[endpoint];
        delete this.torInstances[endpoint];
        if (tor) {
            await tor.close();
        }
    }

    async getUnusedInstance(unused: number, ownIp?: string): Promise<TorInstance> {
        const available = Object.keys(this.torInstances);
        if (ownIp) {
            available.push(ownIp);
        }
        const ip = await getUnusedIp(unused, available);
        if (ip) {
            console.log(`🟢  Got unused IP from manager: ${ip}`);
        } else {
            console.log(`🆕  No unused IP available, creating new one...`);
        }
        if (ip !== undefined && ip === ownIp) {
            // we can use our own IP
            console.log(`🟢 📣  Using own IP ${ip}`);
            return new MockedTorInstance(ip);
        }
        if (ip) {
            console.log(`🛜  Reusing tor instance ${ip}`);
            return this.torInstances[ip];
        }
        return await this.createInstance();
    }
}


const base = 'https://ips.derdorsch.de';
// const base = 'http://localhost:3000';



async function getUnusedIp(ms: number, available: string[]): Promise<string | undefined> {
    const joined = available.join(',');
    const availableParam = joined.length > 0 ? '&available=' + joined : '';
    const url = base + '/unused-ip?ms=' + ms + availableParam;
    const res = await axios.get(url);
    return res.data.ip;
}

export async function reportGeoIssue(ip: string): Promise<void> {
    const url = base + '/geo-issue?ip=' + ip;
    await axios.get(url);
}

export async function reportAlreadyUsed(ip: string): Promise<void> {
    const url = base + '/used-issue?ip=' + ip;
    await axios.get(url);
}

async function registerIp(ip: string): Promise<void> {
    const url = base + '/register-ip?ip=' + ip;
    await axios.get(url);
}

async function getGeoIssues(): Promise<string[]> {
    const url = base;
    const res = await axios.get(url);
    return [...(res.data.geoIssues ?? []), ...(res.data.tempBlocked ?? [])];
}

export async function blockIPForOthers(ip: string): Promise<void> {
    const url = base + '/block-ip?ip=' + ip;
    await axios.get(url);
}

export async function unblockIPForOthers(ip: string): Promise<void> {
    const url = base + '/unblock-ip?ip=' + ip;
    await axios.get(url);
}


async function checkIfNewTorInstanceIsUsedBySomeoneElse(ip: string, unusedSince: number): Promise<boolean> {
    const res = await axios.get(base);
    const ips = res.data.ips as { [key: string]: string };
    // map to as { [key: string]: Date }
    const dateMap: { [key: string]: Date } = {};
    for (const key in ips) {
        dateMap[key] = new Date(ips[key]);
    }
    const now = new Date();
    const usedIp = dateMap[ip];
    if (!usedIp) {
        return false;
    }
    const diff = now.getTime() - usedIp.getTime();
    return diff < unusedSince;
}


//git clone https://github.com/jannikhst/unblocked-browser.git && cd unblocked-browser && ./builder.sh