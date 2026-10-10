"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv = __importStar(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const farmers_1 = __importDefault(require("./routes/farmers"));
const milk_1 = __importDefault(require("./routes/milk"));
const api_1 = __importDefault(require("./routes/api"));
const collection_1 = __importDefault(require("./routes/collection"));
dotenv.config();
const app = (0, express_1.default)();
// Global Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 1. Health Check
app.get('/api-health', (_req, res) => {
    res.json({ status: 'ok', message: 'KINco API operational' });
});
// 2. API Routes Mounting
app.use('/api/auth', auth_1.default);
app.use('/api/farmers', farmers_1.default);
app.use('/api/milk', milk_1.default);
app.use('/api/collection', collection_1.default);
app.use('/api', api_1.default);
// 3. Fallback 404 handler specifically for unhandled /api requests (Returns JSON, not HTML)
app.use('/api/*', (_req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
});
// 4. Serve Static Frontend Files from public/
const publicPath = path_1.default.resolve(process.cwd(), 'public');
app.use(express_1.default.static(publicPath));
// 5. Fallback Route for Direct Page Navigation (HTML)
app.get('*', (_req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'index.html'));
});
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`[SERVER ACTIVE] KINco Backend live on port ${PORT}`);
    });
}
exports.default = app;
