// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const orders = db.collection('orders');

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { orderId } = event;
  
  try {
    // 查询订单信息
    const orderRes = await orders.doc(orderId).get();
    if (!orderRes.data) {
      return {
        success: false,
        message: '订单不存在'
      };
    }
    
    const orderData = orderRes.data;
    
    // 检查订单状态
    if (orderData.status !== 'pending') {
      return {
        success: false,
        message: `订单状态不正确，当前状态: ${orderData.status}`
      };
    }
    
    // 更新订单状态为已完成
    await orders.doc(orderId).update({
      data: {
        status: 'completed',
        completeTime: db.serverDate(),
        completeBy: wxContext.OPENID // 记录是谁完成的订单
      }
    });
    
    return {
      success: true,
      message: '订单已完成'
    };
    
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: '完成订单失败',
      error: err
    };
  }
};