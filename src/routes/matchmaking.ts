import { iMMCodes } from "../model/mmcodes.js";
import Safety from "../utilities/safety.js";
import GameServers from "../model/gameServers.js";
import axios from "axios";
import express from "express";
const app = express.Router();
import functions from "../utilities/structs/functions.js";
import MMCode from "../model/mmcodes.js";
import { verifyToken } from "../tokenManager/tokenVerify.js";
import qs from "qs";
import error from "../utilities/structs/error.js";

let buildUniqueId = {};

async function addSearchingPlayer(playlist: string) {
    try {
        const currentData = await global.kv.get("matchmaking:searching");
        let data = currentData ? JSON.parse(currentData) : { total: 0, playlists: {} };
        
        data.total = (data.total || 0) + 1;
        data.playlists[playlist] = (data.playlists[playlist] || 0) + 1;
        
        await global.kv.set("matchmaking:searching", JSON.stringify(data));
    } catch (error) {
        console.error("Error adding searching player:", error);
    }
}

async function removeSearchingPlayer(playlist: string) {
    try {
        const currentData = await global.kv.get("matchmaking:searching");
        if (!currentData) return;
        
        let data = JSON.parse(currentData);
        
        data.total = Math.max(0, (data.total || 0) - 1);
        data.playlists[playlist] = Math.max(0, (data.playlists[playlist] || 0) - 1);
        
        if (data.playlists[playlist] === 0) {
            delete data.playlists[playlist];
        }
        
        await global.kv.set("matchmaking:searching", JSON.stringify(data));
    } catch (error) {
        console.error("Error removing searching player:", error);
    }
}

async function findAvailableServer(playlist: string) {
    try {
        const allServers = await GameServers.find({ playlist: playlist });
        const now = Date.now();
        const fiveMinAgo = new Date(now - 5 * 60 * 1000);
        const tenMinAgo = new Date(now - 10 * 60 * 1000);

        const availableServers = allServers.filter(server => {
            if (server.status !== 'online') return false;
            if (!server.joinable) return false;
            if (!server.lastHeartbeat || server.lastHeartbeat < fiveMinAgo) return false;
            if (!server.lastJoinabilityUpdate || server.lastJoinabilityUpdate < tenMinAgo) return false;
            return true;
        });

        if (availableServers.length === 0) {
            return null;
        }

        const selectedServer = availableServers[Math.floor(Math.random() * availableServers.length)];
        return selectedServer;
    } catch {
        return null;
    }
}

app.get("/fortnite/api/matchmaking/session/findPlayer/*", (req, res) => {
    res.status(200).end();
});

app.get("/fortnite/api/game/v2/matchmakingservice/ticket/player/*", verifyToken, async (req: any, res) => {
    const playerCustomKey = qs.parse(req.url.split("?")[1], { ignoreQueryPrefix: true })['player.option.customKey'] as string;
    const bucketId = qs.parse(req.url.split("?")[1], { ignoreQueryPrefix: true })['bucketId'] as string;

    if (typeof bucketId !== "string" || bucketId.split(":").length !== 4) {
        return res.status(400).end();
    }

    const playlist = bucketId.split(":")[3];
    
    await global.kv.set(`playerPlaylist:${req.user.accountId}`, playlist);
    
    await global.kv.set(`playerMatchmaking:${req.user.accountId}`, JSON.stringify({
        status: 'searching',
        playlist: playlist,
        startedAt: Date.now()
    }));

        if (typeof playerCustomKey == "string") {
        let codeDocument: iMMCodes = await MMCode.findOne({ code_lower: playerCustomKey?.toLowerCase() }) as iMMCodes;
        if (!codeDocument) {
            return error.createError(
                "errors.com.epicgames.common.matchmaking.code.not_found",
                `The matchmaking code "${playerCustomKey}" was not found`,
                [], 1013, "invalid_code", 404, res
            );
        }

        const kvDocument = JSON.stringify({
            ip: codeDocument.ip,
            port: codeDocument.port,
            playlist: playlist,
        });

        await global.kv.set(`playerCustomKey:${req.user.accountId}`, kvDocument);
        await global.kv.set(`playerMatchmaking:${req.user.accountId}`, JSON.stringify({
            status: 'found',
            playlist: playlist,
            server: kvDocument
        }));
    }

    if (typeof req.query.bucketId !== "string" || req.query.bucketId.split(":").length !== 4) {
        return res.status(400).end();
    }

    buildUniqueId[req.user.accountId] = req.query.bucketId.split(":")[0];

    const matchmakerIP = Safety.env.MATCHMAKER_IP;
    
    const sessionToken = functions.MakeID();
    
    await global.kv.set(`matchmakingSession:${sessionToken}`, JSON.stringify({
        accountId: req.user.accountId,
        playlist: playlist,
        timestamp: Date.now()
    }));

    return res.json({
        "serviceUrl": matchmakerIP.includes("ws") || matchmakerIP.includes("wss") 
            ? `${matchmakerIP}?session=${sessionToken}` 
            : `ws://${matchmakerIP}?session=${sessionToken}`,
        "ticketType": "mms-player",
        "payload": "account",
        "signature": `${req.user.matchmakingId} ${playlist}`
    });
});

app.get("/fortnite/api/game/v2/matchmaking/account/:accountId/session/:sessionId", (req: any, res) => {
    res.json({
        "accountId": req.params.accountId,
        "sessionId": req.params.sessionId,
        "key": "none"
    });
});

app.get("/fortnite/api/matchmaking/session/:sessionId", verifyToken, async (req: any, res) => {
    const playlist = await global.kv.get(`playerPlaylist:${req.user.accountId}`);

    let kvDocument = await global.kv.get(`playerCustomKey:${req.user.accountId}`);

    if (!kvDocument) {
        kvDocument = await global.kv.get(`playerServer:${req.user.accountId}`);
        if (!kvDocument) {
            const dynamicServer = await findAvailableServer(playlist);
            if (dynamicServer) {
                kvDocument = JSON.stringify({
                    ip: dynamicServer.ip,
                    port: dynamicServer.port,
                    playlist: dynamicServer.playlist
                });
            } else {
                return error.createError(
                    "errors.com.epicgames.common.matchmaking.no.dynamic.server.found",
                    `No dynamic server found for playlist ${playlist}`,
                    [], 1013, "invalid_playlist", 404, res
                );
            }
        }
    }

    let codeKV = JSON.parse(kvDocument);
    res.json({
        "id": req.params.sessionId,
        "ownerId": functions.MakeID().replace(/-/ig, "").toUpperCase(),
        "ownerName": "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
        "serverName": "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
        "serverAddress": codeKV.ip,
        "serverPort": parseInt(codeKV.port),
        "maxPublicPlayers": 220,
        "openPublicPlayers": 175,
        "maxPrivatePlayers": 0,
        "openPrivatePlayers": 0,
        "attributes": {
            "REGION_s": "EU",
            "GAMEMODE_s": "FORTATHENA",
            "ALLOWBROADCASTING_b": true,
            "SUBREGION_s": "GB",
            "DCID_s": "FORTNITE-LIVEEUGCEC1C2E30UBRCORE0A-14840880",
            "tenant_s": "Fortnite",
            "MATCHMAKINGPOOL_s": "Any",
            "STORMSHIELDDEFENSETYPE_i": 0,
            "HOTFIXVERSION_i": 0,
            "PLAYLISTNAME_s": codeKV.playlist,
            "SESSIONKEY_s": functions.MakeID().replace(/-/ig, "").toUpperCase(),
            "TENANT_s": "Fortnite",
            "BEACONPORT_i": 15009
        },
        "publicPlayers": [],
        "privatePlayers": [],
        "totalPlayers": 45,
        "allowJoinInProgress": false,
        "shouldAdvertise": false,
        "isDedicated": false,
        "usesStats": false,
        "allowInvites": false,
        "usesPresence": false,
        "allowJoinViaPresence": true,
        "allowJoinViaPresenceFriendsOnly": false,
        "buildUniqueId": buildUniqueId[req.user.accountId] || "0",
        "lastUpdated": new Date().toISOString(),
        "started": false
    });
});

app.post("/fortnite/api/matchmaking/session/*/join", (req, res) => {
    res.status(204).end();
});

app.post("/fortnite/api/matchmaking/session/matchMakingRequest", (req, res) => {
    res.json([]);
});

setInterval(async () => {
    try {
        const cutoffTime = new Date(Date.now() - 10 * 60 * 1000);
        await GameServers.updateMany(
            { lastHeartbeat: { $lt: cutoffTime }, status: 'online' },
            { status: 'offline' }
        );
    } catch {
        // intentionally silent
    }
}, 5 * 60 * 1000);

export default app;