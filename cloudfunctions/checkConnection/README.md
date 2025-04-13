# checkConnection 云函数

## 功能说明
此云函数用于检测微信云开发环境的连接状态，包括数据库连接测试。通过调用此函数，可以快速判断小程序是否能够正常连接云环境，有助于排查网络连接问题。

## 参数说明
无需额外参数。

## 返回值
- 连接成功时返回：
```json
{
  "success": true,
  "message": "云环境连接正常",
  "responseTime": 123, // 响应时间（毫秒）
  "timestamp": "2023-03-26T08:12:34.567Z" // ISO格式的时间戳
}
```

- 连接失败时返回：
```json
{
  "success": false,
  "message": "云环境连接失败",
  "error": "具体错误信息",
  "timestamp": "2023-03-26T08:12:34.567Z"
}
```

## 部署方法
1. 在微信开发者工具中，右键点击 `cloudfunctions/checkConnection` 文件夹
2. 选择"上传并部署：云端安装依赖"
3. 等待部署完成

## 使用示例
```javascript
// 在小程序中调用
wx.cloud.callFunction({
  name: 'checkConnection',
  success: res => {
    console.log('云环境连接状态:', res.result);
    if (res.result.success) {
      console.log(`连接正常，响应时间: ${res.result.responseTime}ms`);
    } else {
      console.error('连接失败:', res.result.error);
    }
  },
  fail: err => {
    console.error('调用云函数失败:', err);
  }
});
```

## 使用场景
- 网络问题排查
- 云环境连接测试
- 系统健康检查 