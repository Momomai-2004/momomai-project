// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const orders = db.collection('orders');
const users = db.collection('users');
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { orderId, cancelReason } = event;
  
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
    
    // 更新订单状态为已取消
    await orders.doc(orderId).update({
      data: {
        status: 'cancelled',
        cancelTime: db.serverDate(),
        cancelBy: wxContext.OPENID, // 记录是谁取消的订单
        cancelReason: cancelReason || '用户取消'
      }
    });
    
    // 退还用户余额或次数
    if (orderData.paymentMethod === 'wallet') {
      // 退还钱包余额
      await users.where({
        _openid: orderData._openid
      }).update({
        data: {
          walletBalance: _.inc(orderData.amount)
        }
      });
    } else if (orderData.paymentMethod === 'count') {
      // 退还次数
      const updateData = {};
      switch(orderData.serviceType) {
        case 'basic60':
          updateData.basic60Count = _.inc(1);
          break;
        case 'basic90':
          updateData.basic90Count = _.inc(1);
          break;
        case 'advanced60':
          updateData.advanced60Count = _.inc(1);
          break;
        case 'advanced90':
          updateData.advanced90Count = _.inc(1);
          break;
      }
      
      if (Object.keys(updateData).length > 0) {
        await users.where({
          _openid: orderData._openid
        }).update({
          data: updateData
        });
      }
    }
    
    return {
      success: true,
      message: '订单已取消'
    };
    
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: '取消订单失败',
      error: err
    };
  }
};