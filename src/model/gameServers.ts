import mongoose from "mongoose";


export interface iGameServer {
    _id?: string;
    ip: string;
    port: number;
    playlist: string;
    name: string;
    region?: string;
    maxPlayers?: number;
    currentPlayers?: number;
    status: 'online' | 'offline' | 'maintenance';
    joinable: boolean;
    lastHeartbeat: Date;
    lastJoinabilityUpdate: Date;
    registeredAt: Date;
    serverKey?: string;

}



const GameServerSchema = new mongoose.Schema({
    ip: { type: String, required: true },
    port: { type: Number, required: true },
    playlist: { type: String, required: true },
    name: { type: String, required: true },
    region: { type: String, default: 'EU' },
    maxPlayers: { type: Number, default: 100 },
    currentPlayers: { type: Number, default: 0 },

    status: { 
        type: String, 
        enum: ['online', 'offline', 'maintenance'], 
        default: 'online' 
    },

    joinable: { type: Boolean, default: true },
    lastHeartbeat: { type: Date, default: Date.now },
    lastJoinabilityUpdate: { type: Date, default: Date.now },
    registeredAt: { type: Date, default: Date.now },
    serverKey: { type: String }
}, {
    collection: "gameServers"
});

GameServerSchema.index({ playlist: 1, status: 1 });
GameServerSchema.index({ lastHeartbeat: 1 });

export default mongoose.model("GameServers", GameServerSchema);