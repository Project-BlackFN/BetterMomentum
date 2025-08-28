import express from "express";
import GameServers, { iGameServer } from "../model/gameServers.js";
import crypto from "crypto";
import log from "../utilities/structs/log.js";

const app = express.Router();

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

        const existingServer = await GameServers.findOne({ ip, port, playlist });

        if (existingServer) {
            // update server
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
            playlist,
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
        });
    } catch (error) {
        console.error("Server registration error:", error);
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
        
        const servers = await GameServers.find({ status: "online" });
        const now = Date.now();
        const fiveMinAgo = new Date(now - 5 * 60 * 1000);
        const tenMinAgo = new Date(now - 10 * 60 * 1000);

        const playlistCounts: Record<string, number> = {};
        const availableServersByPlaylist: Record<string, number> = {};

        for (const server of servers) {
            const playlist = server.playlist;
            playlistCounts[playlist] = (playlistCounts[playlist] || 0) + 1;

            const isAvailable = server.joinable && 
                               server.lastHeartbeat && server.lastHeartbeat >= fiveMinAgo &&
                               server.lastJoinabilityUpdate && server.lastJoinabilityUpdate >= tenMinAgo;
            
            if (isAvailable) {
                availableServersByPlaylist[playlist] = (availableServersByPlaylist[playlist] || 0) + 1;
            }
        }

        if (Object.keys(playlistCounts).length === 0) {
            return res.json({ 
                server_scaling_required: false, 
                gamemode: null,
                message: "No servers registered"
            });
        }

        const topGamemode = Object.entries(playlistCounts)
            .sort((a, b) => b[1] - a[1])[0][0];

        const availableServersForTop = availableServersByPlaylist[topGamemode] || 0;
        const scalingRequired = availableServersForTop === 0;

        return res.json({
            server_scaling_required: scalingRequired,
            gamemode: topGamemode,
            available_servers: availableServersForTop,
            total_servers: playlistCounts[topGamemode]
        });
    } catch (error) {
        console.error("serverInfo error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default app;