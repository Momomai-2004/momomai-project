// 云函数入口文件
const cloud = require('wx-server-sdk');

// 初始化云环境
cloud.init({
  env: 'chilling-4gdawl4ea811c0cd' // 使用确切的环境ID
});

const db = cloud.database();
const users = db.collection('users');

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { userId, newInfo, staffInfo } = event;
  
  console.log('收到请求参数:', event);
  
  try {
    // 基本参数检查
    if (!userId || !newInfo) {
      return {
        success: false,
        message: '参数不完整',
        details: { userId }
      };
    }
    
    // 查询会员信息确保存在
    let userRes;
    try {
      userRes = await users.doc(userId).get();
      console.log('获取到用户数据:', userRes.data);
    } catch (err) {
      console.error('查询会员信息失败:', err);
      return {
        success: false,
        message: '会员信息查询失败: ' + (err.message || err),
        errCode: err.errCode
      };
    }
    
    if (!userRes.data) {
      return {
        success: false,
        message: '会员不存在'
      };
    }
    
    const userData = userRes.data;
    
    // 准备更新的数据
    const updateData = {
      nickName: newInfo.nickName,
      phone: newInfo.phone,
      wallet_balance: newInfo.wallet_balance,
      remaining_times: newInfo.remaining_times,
      update_time: db.serverDate()
    };
    
    // 处理员工信息
    if (staffInfo && staffInfo._id) {
      updateData.updated_by = staffInfo._id;
      updateData.updated_by_name = staffInfo.name || '员工';
    }
    
    // 处理服务次数相关的数据
    if (newInfo.service_times) {
      updateData.service_times = newInfo.service_times;
      
      // 计算总次数，确保与各项目次数之和相符
      updateData.remaining_times = 
        (newInfo.service_times.basic_60 || 0) +
        (newInfo.service_times.basic_90 || 0) +
        (newInfo.service_times.advanced_60 || 0) +
        (newInfo.service_times.advanced_90 || 0);
    }
    
    console.log('准备更新会员数据:', updateData);
    
    // 更新会员信息
    try {
      const updateResult = await users.doc(userId).update({
        data: updateData
      });
      console.log('更新会员信息结果:', updateResult);
      
      return {
        success: true,
        message: '会员信息已更新',
        updateData
      };
    } catch (err) {
      console.error('更新会员信息失败:', err);
      return {
        success: false,
        message: '更新会员信息失败: ' + (err.message || err),
        errCode: err.errCode
      };
    }
  } catch (err) {
    console.error('云函数执行出错:', err);
    return {
      success: false,
      message: '操作失败: ' + (err.message || err),
      errCode: err.errCode || -1
    };
  }
}; 