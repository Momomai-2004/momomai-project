# getOrdersByStatus 云函数

这个云函数用于根据订单状态获取用户订单，支持获取已过期的订单（已支付但服务时间已结束的订单）。

## 功能

1. 根据指定状态查询当前用户的订单
2. 可以指定是否包含或只获取已过期的订单（仅针对已支付状态的订单）
3. 自动查询多个可能的集合（如orders, appointments）
4. 返回订单所在的集合名称，方便后续更新操作

## 参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| status | String | 是 | 订单状态，如 'paid', 'pending', 'completed', 'cancelled' |
| includeExpired | Boolean | 否 | 是否包含已过期订单，默认为false（仅针对paid状态有效） |
| onlyExpired | Boolean | 否 | 是否只返回已过期订单，默认为false（仅针对paid状态有效） |

## 返回数据

成功返回：
```json
{
  "success": true,
  "orders": [ 
    {
      "_id": "订单ID",
      "status": "订单状态",
      "appointment_date": "预约日期",
      "time_slot": "预约时间段",
      "service_duration": "服务时长",
      "_collection": "订单所在集合名称",
      // ... 其他订单字段
    }
  ],
  "count": 订单数量
}
```

失败返回：
```json
{
  "success": false,
  "errMsg": "错误信息"
}
```

## 部署步骤

1. 在微信开发者工具中，打开云开发控制台
2. 选择"云函数"
3. 找到"getOrdersByStatus"云函数
4. 点击"上传并部署：云端安装依赖"
5. 等待部署完成

## 调用示例

```javascript
// 获取所有已支付订单
wx.cloud.callFunction({
  name: 'getOrdersByStatus',
  data: {
    status: 'paid'
  }
})
.then(res => {
  if (res.result && res.result.success) {
    const orders = res.result.orders;
    console.log(`获取到 ${orders.length} 个已支付订单`);
  }
})
.catch(err => {
  console.error('获取订单失败:', err);
});

// 获取已支付但服务时间已结束的订单
wx.cloud.callFunction({
  name: 'getOrdersByStatus',
  data: {
    status: 'paid',
    onlyExpired: true
  }
})
.then(res => {
  if (res.result && res.result.success) {
    const expiredOrders = res.result.orders;
    console.log(`获取到 ${expiredOrders.length} 个已过期订单`);
  }
})
.catch(err => {
  console.error('获取已过期订单失败:', err);
});
``` 