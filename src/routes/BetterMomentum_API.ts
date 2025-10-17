import express from "express";
import GameServers, { iGameServer } from "../model/gameServers.js";
import crypto from "crypto";
import log from "../utilities/structs/log.js";
import functions from "../utilities/structs/functions.js";
import Users from '../model/user.js';
import Profiles from '../model/profiles.js';
import Friends from '../model/friends.js';

const app = express.Router();

let serverAccounts = new Map<string, { deleteToken: string, accountId: string }>();

const PLAYLIST_MAP: Record<string, string> = { // a filter for the gs
    "2": "/Game/Athena/Playlists/Playlist_DefaultSolo.Playlist_DefaultSolo",
    "10": "/Game/Athena/Playlists/Playlist_DefaultDuo.Playlist_DefaultDuo",
    "9": "/Game/Athena/Playlists/Playlist_DefaultSquad.Playlist_DefaultSquad",
    "playlist_defaultsolo": "/Game/Athena/Playlists/Playlist_DefaultSolo.Playlist_DefaultSolo",
    "playlist_defaultduo": "/Game/Athena/Playlists/Playlist_DefaultDuo.Playlist_DefaultDuo",
    "playlist_defaultsquad": "/Game/Athena/Playlists/Playlist_DefaultSquad.Playlist_DefaultSquad",
    "playlist_solidgold_solo": "/Game/Athena/Playlists/Playlist_SolidGold_Solo.Playlist_SolidGold_Solo",
    "playlist_snipers_solo": "/Game/Athena/Playlists/Playlist_Snipers_Solo.Playlist_Snipers_Solo"
};

app.post("/bettermomentum/addserver", async (req, res) => {
    try {
        const { ip, port, playlist, serverKey } = req.body;

        if (!ip || !port || !playlist || !serverKey) {
            return res.status(400).json({
                error: "Missing required fields: ip, port, playlist, serverKey",
            });
        }

        const expectedServerKey = process.env.SERVER_AUTH_KEY;
        if (expectedServerKey && serverKey !== expectedServerKey) {
            return res.status(401).json({ error: "Invalid server key" });
        }

        const playlistPath = PLAYLIST_MAP[playlist.toLowerCase()] || playlist;

        const existingServer = await GameServers.findOne({ ip, port, playlist: playlistPath });

        if (existingServer) {
            existingServer.lastHeartbeat = new Date();
            existingServer.lastJoinabilityUpdate = new Date();
            existingServer.status = "online";
            existingServer.joinable = true;

            await existingServer.save();
            log.backend("Server updated");

            return res.json({
                message: "Server already existed, updated successfully",
                serverId: existingServer._id,
                serverSecretKey: existingServer.serverKey,
            });
        }

        const serverSecretKey = crypto.randomUUID();
        const newServer = new GameServers({
            ip,
            port,
            playlist: playlistPath,
            name: `Server-${ip}:${port}`,
            region: "EU",
            maxPlayers: 100,
            currentPlayers: 0,
            status: "online",
            joinable: true,
            lastHeartbeat: new Date(),
            lastJoinabilityUpdate: new Date(),
            serverKey: serverSecretKey,
        });

        await newServer.save();
        log.backend("Register success");

        return res.status(201).json({
            message: "Server registered successfully",
            serverId: newServer._id,
            serverSecretKey,
            playlist: playlistPath, 
        });
    } catch (error) {
        console.error("Server registration error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/bettermomentum/checklogin", async (req, res) => {
    try {
        const {email, password} = req.body;

        if (!email || !password) {
            return res.status(400).json({
                code: "blackfn.missing_fields",
                message: "Missing required fields: email, password",
            });
        }

        const user = await Users.findOne({ email });

        if (!user) {
            return res.status(401).json({
                code: "blackfn.invalid_credentials",
                message: "Invalid email or password",
                success: false,
            });
        }

        const bcrypt = await import('bcrypt');
        const isPasswordValid = await bcrypt.default.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                code: "blackfn.invalid_credentials",
                message: "Invalid email or password",
                success: false
            });
        }

        return res.json({
            success: true,
            code: "blackfn.login_success",
            message: "Login successful",
            accountId: user.accountId,
            username: user.username,
            email: user.email
        });

    } catch (error) {
        console.error("Check login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


app.post("/bettermomentum/heartbeat", async (req, res) => {
    try {
        const { serverKey, ip, port, joinable } = req.body;

        if (!serverKey || !ip || !port || typeof joinable !== "boolean") {
            return res.status(400).json({
                error: "Missing required fields: serverKey, ip, port, joinable (boolean)",
            });
        }

        const server = await GameServers.findOne({ serverKey, ip, port });

        if (!server) {
            return res
                .status(404)
                .json({ error: "Server not found with provided serverKey" });
        }

        server.lastHeartbeat = new Date();
        server.lastJoinabilityUpdate = new Date();
        server.status = "online";
        server.joinable = joinable;
        await server.save();

        res.json({
            message: "Heartbeat received and joinability updated",
            server: `${server.ip}:${server.port}`,
            playlist: server.playlist,
            joinable,
        });
    } catch (error) {
        console.error("Heartbeat error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/bettermomentum/removeserver", async (req, res) => {
    try {
        const { serverKey, ip, port } = req.body;

        if (!serverKey || !ip || !port) {
            return res.status(400).json({
                error: "Missing required fields: serverKey, ip, port",
            });
        }

        const server = await GameServers.findOne({ serverKey, ip, port });

        if (!server) {
            return res
                .status(404)
                .json({ error: "Server not found or invalid serverKey" });
        }

        await GameServers.deleteOne({ _id: server._id });

        res.json({ message: "Server unregistered successfully" });
    } catch (error) {
        console.error("Remove server error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/bettermomentum/serverlist", async (_req, res) => {
    try {
        const servers = await GameServers.find({ status: "online" });
        res.json(servers);
    } catch (error) {
        console.error("Get servers error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/bettermomentum/matchmaker/serverInfo", async (_req, res) => {
    try {
        const searchingData = await global.kv.get("matchmaking:searching");
        
        if (!searchingData) {
            return res.json({ server_scaling_required: false, gamemode: null });
        }

        const parsed = JSON.parse(searchingData);
        const playlistCounts = parsed.playlists || {};
        
        const entries = Object.entries(playlistCounts);
        if (entries.length === 0) {
            return res.json({ server_scaling_required: false, gamemode: null });
        }

        const topGamemode = entries.sort((a: any, b: any) => b[1] - a[1])[0][0];

        const servers = await GameServers.find({ playlist: topGamemode });
        const now = Date.now();
        const fiveMinAgo = new Date(now - 5 * 60 * 1000);
        const tenMinAgo = new Date(now - 10 * 60 * 1000);

        const availableServers = servers.filter(server => {
            if (server.status !== "online") return false;
            if (!server.joinable) return false;
            if (!server.lastHeartbeat || server.lastHeartbeat < fiveMinAgo) return false;
            if (!server.lastJoinabilityUpdate || server.lastJoinabilityUpdate < tenMinAgo) return false;
            return true;
        });

        const scalingRequired = availableServers.length === 0;

        return res.json({
            server_scaling_required: scalingRequired,
            gamemode: topGamemode,
        });
    } catch (error) {
        console.error("serverInfo error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/bettermomentum/serveraccount/create", async (req, res) => {
    try {
        const { serverKey } = req.body;
        if (!serverKey || serverKey !== process.env.SERVER_AUTH_KEY) {
            return res.status(401).json({ error: "Invalid server key" });
        }

        const accountId = crypto.randomBytes(4).toString("hex");
        const randomId = crypto.randomBytes(4).toString("hex");
        const discordId = crypto.randomBytes(4).toString("hex");
        const username = `bfntmp-${randomId}`;
        const email = `blackfn-${randomId}@bettermomentum.org`;
        const plainPassword = crypto.randomBytes(12).toString("base64").slice(0, 16);
        const deleteToken = crypto.randomBytes(16).toString("hex");

        const result = await functions.registerServer(discordId, accountId, username, email, plainPassword);

        if (result.status !== 200) {
            console.error("Error registering server account:", result.message);
            return res.status(500).json({ error: "Failed to register server account", details: result.message });
        }

        serverAccounts.set(accountId, { deleteToken, accountId });
        log.backend(`Server account created: ${username}`);

        return res.status(201).json({
            message: "Server account created successfully",
            
            accountId,
            username,
            email,
            password: plainPassword,
            deleteToken
        });

    } catch (error) {
        console.error("Server account creation error:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


app.post("/bettermomentum/serveraccount/delete", async (req, res) => {
    try {
        const { deleteToken } = req.body;

        if (!deleteToken) {
            return res.status(400).json({ error: "Missing deleteToken" });
        }

        let accountIdToDelete: string | null = null;

        for (const [accountId, data] of serverAccounts.entries()) {
            if (data.deleteToken === deleteToken) {
                accountIdToDelete = accountId;
                break;
            }
        }

        if (!accountIdToDelete) {
            return res.status(404).json({ error: "Invalid deleteToken or account not found" });
        }

        await Users.findOneAndDelete({ accountId: accountIdToDelete });
        await Profiles.findOneAndDelete({ accountId: accountIdToDelete });
        await Friends.findOneAndDelete({ accountId: accountIdToDelete });

        serverAccounts.delete(accountIdToDelete);

        log.backend(`Server account deleted: ${accountIdToDelete}`);

        return res.json({
            message: "Server account deleted successfully",
            accountId: accountIdToDelete
        });

    } catch (error) {
        console.error("Server account deletion error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default app;