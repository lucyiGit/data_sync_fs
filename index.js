const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors"); // 引入cors中间件

const { getTableMeta } = require("./table_meta.js");
const { getTableRecords } = require("./table_records.js");
const { judgeEncryptSignValid } = require("./request_sign.js");

const app = express();

// 配置CORS
app.use(
    cors({
        origin: "https://4f037149-92a1-4beb-9833-d38f60cf9950-00-3olderhlk9mlz.pike.replit.dev", // 允许的前端域名
        methods: ["GET", "POST", "OPTIONS"], // 允许的HTTP方法
        allowedHeaders: ["Content-Type", "Authorization"], // 允许的请求头，必须包含Content-Type
    }),
);

app.use(express.json());

// 处理预检请求
app.options("*", cors());

app.get("/", (req, res) => {
    res.send("hello world");
});

app.get("/meta.json", (req, res) => {
    console.log("meta.json的请求数据", req.headers);
    fs.readFile(
        path.join(__dirname, "./public/meta.json"),
        "utf8",
        (err, data) => {
            res.set("Content-Type", "application/json");
            res.status(200).send(data);
        },
    );
});

app.post("/api/table_meta", async (req, res) => {
    try {
        const mongoParams = req.body;
        console.log("table_meta的请求数据", mongoParams);
        console.log("加密判断结果：", judgeEncryptSignValid(req));
        // 从请求体中获取MongoDB连接参数
        // 调用异步函数获取表格元数据
        const tableMeta = await getTableMeta(mongoParams);
        const result = { code: 0, message: "POST请求成功", data: tableMeta };
        res.status(200).json(result);
    } catch (error) {
        console.error("获取表格元数据失败:", error);
        res.status(500).json({
            code: 1,
            message: "获取表格元数据失败: " + error.message,
            data: null
        });
    }
});

// 添加JSON解析错误处理中间件
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
        console.error('JSON解析错误:', err);
        return res.status(400).json({
            code: 400,
            message: '请求数据格式无效: ' + err.message,
            data: null
        });
    }
    next();
});

app.post("/api/records", async (req, res) => {
    try {
        // 改进日志记录，只记录必要信息
        console.log("table_records 请求头:", req.headers['content-type']);
        const params = req.body;
        console.log("table_records 请求体:", params);
        console.log("加密判断结果：", judgeEncryptSignValid(req));

        // 验证请求参数
        if (!params || typeof params !== 'object') {
            throw new Error('请求参数必须是非空对象');
        }

        // 调用异步函数获取表格记录
        const tableRecords = await getTableRecords(params);
        const result = {
            code: 0,
            message: "POST请求成功",
            data: tableRecords,
        };
        res.status(200).json(result);
    } catch (error) {
        console.error("获取表格记录失败:", error);
        res.status(500).json({
            code: 1,
            message: "获取表格记录失败: " + error.message,
            data: null
        });
    }
});

app.listen(3000, () => {
    console.log("Express server initialized");
});
