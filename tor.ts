// run /usr/local/opt/tor/bin/tor

import { spawn, exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import net from 'net';
import crypto from 'crypto';

export class TorInstance {
    private onClose: () => Promise<void>;
    proxyIp: string;
    port: number;
    info: ApiIpResult;

    constructor(onClose: () => Promise<void>, ip: string, port: number, info: ApiIpResult) {
        this.onClose = onClose;
        this.proxyIp = ip;
        this.port = port;
        this.info = info;
    }

    get proxyUrl() {
        return `socks5://${this.proxyIp}:${this.port}`;
    }

    close(): Promise<void> {
        return this.onClose();
    }

    static async existsInstance(hash: string): Promise<number> {
        try {
            const stdout = await execPromise(`ps aux | grep "${hash}"`);
            let lines = stdout.split('\n');
            lines = lines.filter(l => !l.includes('grep'));
            lines = lines.filter(l => l.trim().length > 0);
            if (lines.length > 0) {
                const fragments = lines[0].split(' ');
                try {
                    const pid = parseInt(fragments[1].trim());
                    return pid;
                } catch (error) {
                    return -1;
                }
            }
        } catch (error) {
        }
        return -1;
    }

    static async waitTillTorStopped(hash: string): Promise<void> {
        while (true) {
            const pid = await TorInstance.existsInstance(hash);
            if (pid < 0) {
                return;
            }
            await new Promise<void>((resolve) => setTimeout(resolve, 500));
        }
    }


    static async create(config: TorConfig): Promise<TorInstance> {
        let txt = '';
        if (config.ExitNodes && config.ExitNodes.length > 0) {
            const nodes = config.ExitNodes.map(l => `{${l}}`).join(',');
            txt += 'ExitNodes ' + nodes + '\n';
        }
        if (config.StrictNodes) {
            txt += 'StrictNodes 1\n';
        }
        if (config.MaxCircuitDirtiness) {
            txt += `MaxCircuitDirtiness ${config.MaxCircuitDirtiness}\n`;
        }
        txt += 'MaxCircuitDirtiness 20000\n';

        // find free port for socks5 proxy
        const { socksPort, controlPort } = await findFreePortPair();
        txt += `SocksPort ${socksPort}\n`;
        // txt += `ControlPort ${controlPort}\n`;

        const hash = crypto.createHash('sha256').update(txt).digest('hex');
        const torrcFileName = `torrc_${hash}`;
        const dataDirectory = path.join(__dirname, 'tor_data_' + hash);
        txt += `DataDirectory ${dataDirectory}\n`;
        fs.mkdir(dataDirectory).catch(e => console.log(e));
        const torrcPath = path.join(__dirname, torrcFileName);
        await fs.writeFile(torrcPath, txt, 'utf-8').catch(e => console.log(e));
        const torPath = await execPromise('which tor').catch(() => {
            console.log('tor not found, please install tor');
            process.exit(1);
        });

        const filePath = path.join(__dirname, torrcFileName);
        const tor = spawn(torPath.trim(), ['-f', filePath]);
        let ip = '';
        let port = 0;
        let pid: number | undefined;
        await new Promise<void>((resolve, reject) => {
            let up = false;
            tor.stdout.on('data', (data) => {
                const text = data.toString();
                if (text.includes('100%')) {
                    up = true;
                    resolve();
                }
                const match2 = text.match(/Opening Socks listener on (.+):(\d+)/g);
                if (match2) {
                    const parts = match2[0].split(' ');
                    ip = parts[4].split(':')[0];
                    port = parseInt(parts[4].split(':')[1]);
                }
            });
            tor.on('close', async (code) => {
                await new Promise<void>((resolve) => setTimeout(resolve, 500));
                if (up) {
                    return;
                }
                console.log('tor is already running, looking for pid');
                const pid = await TorInstance.existsInstance(hash);
                if (pid > 0) {
                    resolve();
                    return;
                }
            });
        });

        const curlCmd = `curl --socks5 ${ip + ':' + port} --socks5-hostname ${ip + ':' + port} -s http://ip-api.com/json/`;
        const api = await execPromise(curlCmd)
            .then(r => {
                try {
                    const json = JSON.parse(r);
                    return ApiIpResult.fromJson(json);
                } catch (error) {
                    return ApiIpResult.unknown();
                }
            })
            .catch(e => ApiIpResult.unknown());
        if (pid) {
            return new TorInstance(() => {
                return new Promise<void>(async (resolve, reject) => {
                    await execPromise(`kill ${pid}`).catch(e => console.log(e));
                    await TorInstance.waitTillTorStopped(hash);
                    // await removeTorHashData(hash);
                    resolve();
                });
            }, ip, port, api);
        }
        return new TorInstance(async () => {
            tor.kill();
            await TorInstance.waitTillTorStopped(hash);
            // await removeTorHashData(hash);
        }, ip, port, api);
    }
}

// async function removeTorHashData(hash: string) {
//     try {
//         const dataDirectory = path.join(__dirname, 'tor_data_' + hash);
//         await fs.rm(dataDirectory, { recursive: true }).catch(e => console.log(e));
//         const torrcFileName = `torrc_${hash}`;
//         const torrcPath = path.join(__dirname, torrcFileName);
//         await fs.unlink(torrcPath).catch(e => console.log(e));
//     } catch (error) { }
// }

async function findFreePortPair(): Promise<{ socksPort: number, controlPort: number }> {
    const start = Math.floor(Math.random() * 10000) + 10000;
    const end = start + 10000;
    for (let i = start; i < end; i++) {
        const socksPort = i;
        const controlPort = i + 1;
        const socksPortFree = await portIsFree(socksPort);
        const controlPortFree = await portIsFree(controlPort);
        if (socksPortFree && controlPortFree) {
            return { socksPort, controlPort };
        }
    }
    throw new Error('No free port pair found');
}

async function portIsFree(port: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
        const server = net.createServer();
        server.once('error', (err: any) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port);
    });
}

async function execPromise(command: string) {
    return new Promise<string>((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject(err);
                return;
            }
            resolve(stdout);
        });
    });
}

export interface TorConfig {
    ExitNodes?: string[];
    MaxCircuitDirtiness?: number;
    StrictNodes?: boolean;

}

class ApiIpResult {
    status: string;
    country: string;
    countryCode: string;
    region: string;
    regionName: string;
    city: string;
    zip: string;
    lat: number;
    lon: number;
    timezone: string;
    isp: string;
    org: string;
    as: string;
    query: string;

    constructor(status: string, country: string, countryCode: string, region: string, regionName: string, city: string, zip: string, lat: number, lon: number, timezone: string, isp: string, org: string, as: string, query: string) {
        this.status = status;
        this.country = country;
        this.countryCode = countryCode;
        this.region = region;
        this.regionName = regionName;
        this.city = city;
        this.zip = zip;
        this.lat = lat;
        this.lon = lon;
        this.timezone = timezone;
        this.isp = isp;
        this.org = org;
        this.as = as;
        this.query = query;
    }

    static fromJson(json: any): ApiIpResult {
        return new ApiIpResult(json.status, json.country, json.countryCode, json.region, json.regionName, json.city, json.zip, json.lat, json.lon, json.timezone, json.isp, json.org, json.as, json.query);
    }

    get ip() {
        return this.query;
    }

    get info() {
        // [ip] country, region, city
        return `[${this.ip}]: ${this.country}, ${this.region}, ${this.city}`;
    }

    static unknown(): ApiIpResult {
        const json = {
            "status": "success",
            "country": "Unknown Country",
            "countryCode": "XX",
            "region": "XX",
            "regionName": "Unknown Region",
            "city": "Unknown City",
            "zip": "XXXXX",
            "lat": 0,
            "lon": 0,
            "timezone": "Europe/Berlin",
            "isp": "Unknown ISP",
            "org": "Unknown Organization",
            "as": "AS0",
            "query": "XXX.XXX.XXX.XXX"
        };
        return ApiIpResult.fromJson(json);
    }
}