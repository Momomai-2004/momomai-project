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
  const { orderNumber, verificationCode } = event;
  
  try {
    // 查询订单信息
    const orderRes = await orders.where({
      orderNumber: orderNumber
    }).get();
    
    if (orderRes.data.length === 0) {
      return {
        success: false,
        message: '订单不存在'
      };
    }
    
    const orderData = orderRes.data[0];
    
    // 检查订单状态
    if (orderData.status !== 'pending') {
      return {
        success: false,
        message: `订单状态不正确，当前状态: ${orderData.status === 'completed' ? '已完成' : '已取消'}`
      };
    }
    
    // 检查核销码
    if (orderData.verificationCode !== verificationCode) {
      return {
        success: false,
        message: '核销码不正确'
      };
    }
    
    // 检查是否已核销
    if (orderData.isVerified) {
      return {
        success: false,
        message: '订单已核销'
      };
    }
    
    // 更新订单为已核销
    await orders.doc(orderData._id).update({
      data: {
        isVerified: true,
        verifyTime: db.serverDate(),
        verifyBy: wxContext.OPENID, // 记录是谁核销的
        status: 'completed' // 同时将订单状态改为已完成
      }
    });
    
    return {
      success: true,
      message: '核销成功',
      orderInfo: {
        serviceName: orderData.serviceName,
        appointmentTime: orderData.appointmentTime,
        contactName: orderData.contactName,
        contactPhone: orderData.contactPhone
      }
    };
    
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: '核销失败',
      error: err
    };
  }
};