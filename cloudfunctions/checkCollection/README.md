# checkCollection 云函数

这个云函数用于检查数据库中是否存在指定的集合，避免在小程序中直接查询不存在的集合导致的错误。

## 功能

- 检查给定集合名称在数据库中是否存在
- 返回集合中的数据计数（如果存在）

## 参数

- `collection`：要检查的集合名称，如 'appointments'、'orders' 等

## 返回数据

成功响应：
```json
{
  "success": true,
  "exists": true|false,
  "count": 0 // 如果集合存在，返回集合中的数据量
}
```

失败响应：
```json
{
  "success": false,
  "exists": false,
  "error": "错误信息"
}
```

## 部署指南

1. 在微信开发者工具中，打开云开发控制台
2. 选择"云函数"选项卡
3. 右键点击左侧cloudfunctions目录下的"checkCollection"文件夹
4. 选择"上传并部署：云端安装依赖"
5. 等待部署完成

## 使用示例

```javascript
wx.cloud.callFunction({
  name: 'checkCollection',
  data: {
    collection: 'appointments'
  },
  success: res => {
    if (res.result && res.result.exists) {
      console.log('集合存在！');
    } else {
      console.log('集合不存在');
    }
  },
  fail: err => {
    console.error('检查失败', err);
  }
});
``` 