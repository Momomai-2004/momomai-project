# batchUpdateOrders 云函数

这个云函数用于批量更新订单状态，特别是处理那些有支付方式(如`times`)但状态不是`paid`的订单。

## 功能

- 批量更新多个订单的状态或其他字段
- 支持跨集合更新（可以同时更新"appointments"和"orders"集合）
- 提供详细的更新结果报告

## 参数

- `orders`: 要更新的订单列表，每个订单应包含以下字段：
  - `id`: 订单ID
  - `collection`: 集合名称（默认为"appointments"）
- `updateData`: 要更新的数据对象，例如 `{ status: 'paid' }`

## 返回数据

成功响应：
```json
{
  "success": true,
  "updated": 5,    // 成功更新的订单数量
  "failed": 0,     // 更新失败的订单数量
  "total": 5,      // 总共处理的订单数量
  "results": [     // 每个订单的更新结果
    {
      "id": "orderId1",
      "success": true,
      "updated": 1,
      "collection": "appointments"
    },
    ...
  ]
}
```

失败响应：
```json
{
  "success": false,
  "error": "错误信息"
}
```

## 部署指南

1. 在微信开发者工具中，打开云开发控制台
2. 选择"云函数"选项卡
3. 右键点击左侧cloudfunctions目录下的"batchUpdateOrders"文件夹
4. 选择"上传并部署：云端安装依赖"
5. 等待部署完成

## 使用示例

```javascript
wx.cloud.callFunction({
  name: 'batchUpdateOrders',
  data: {
    orders: [
      { id: 'order1', collection: 'appointments' },
      { id: 'order2', collection: 'orders' }
    ],
    updateData: {
      status: 'paid'
    }
  },
  success: res => {
    console.log('批量更新结果:', res.result);
  },
  fail: err => {
    console.error('批量更新失败:', err);
  }
});
``` 