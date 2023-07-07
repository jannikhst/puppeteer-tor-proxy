import axios from "axios";
import { wait } from "./action";
import { TorConfig, TorInstance } from "./tor";

export class IpWorker {
    private torInstances: { [key: string]: TorInstance } = {};

    async createInstance(): Promise<TorInstance> {
        console.log('🛜  Creating tor instance...');
        const config: TorConfig = {
            ExitNodes: ['de'],
            StrictNodes: true,
        };
        const geoIssues = await getGeoIssues();
        while (true) {
            const tor = await TorInstance.create(config);
            // check if instance already exists
            const endpoint = tor.info.ip;
            if (this.torInstances[endpoint] || geoIssues.includes(endpoint)) {
                await tor.close();
                await wait(1000);
                console.log('🟡  Had issues with this IP before, switching...');
                continue;
            }
            this.torInstances[endpoint] = tor;
            console.log(`🤖  Created tor instance ${tor.info.info}`);
            await registerIp(endpoint);
            return tor;
        }
    }

    async closeInstance(endpoint: string): Promise<void> {
        console.log(`🟠 Closing tor instance ${endpoint}`);
        const tor = this.torInstances[endpoint];
        delete this.torInstances[endpoint];
        if (tor) {
            await tor.close();
        }
    }

    async getUnusedInstance(unused: number): Promise<TorInstance> {
        const ip = await getUnusedIp(unused, Object.keys(this.torInstances));
        if (ip) {
            console.log(`🟢  Got unused IP from manager: ${ip}`);
        } else {
            console.log(`🆕  No unused IP available, creating new one...`);
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
    return res.data.geoIssues ?? [];
}