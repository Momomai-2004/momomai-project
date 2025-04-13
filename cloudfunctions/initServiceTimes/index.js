// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 计算总次数的函数
function calculateTotalTimes(serviceTimes) {
  return (
    (serviceTimes.basic_60 || 0) +
    (serviceTimes.basic_90 || 0) +
    (serviceTimes.advanced_60 || 0) +
    (serviceTimes.advanced_90 || 0)
  );
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { userId } = event
  
  if (!userId) {
    return {
      success: false,
      message: '未提供用户ID'
    }
  }

  try {
    // 首先查询用户数据，检查是否真的需要初始化
    const userRes = await db.collection('users').doc(userId).get()
    const userData = userRes.data
    
    // 如果用户数据不存在，返回错误
    if (!userData) {
      return {
        success: false,
        message: '未找到用户数据'
      }
    }
    
    // 如果service_times已存在且有值，则不需要更新
    if (userData.service_times && 
        typeof userData.service_times === 'object' && 
        Object.keys(userData.service_times).length > 0) {
      
      // 验证并更新总次数
      const totalTimes = calculateTotalTimes(userData.service_times);
      
      // 如果总次数与各项目次数之和不一致，则更新总次数
      if (userData.remaining_times !== totalTimes) {
        await db.collection('users').doc(userId).update({
          data: {
            remaining_times: totalTimes
          }
        });
        
        return {
          success: true,
          message: 'remaining_times已更新为各项目次数之和',
          oldTotal: userData.remaining_times,
          newTotal: totalTimes
        }
      }
      
      return {
        success: true,
        message: 'service_times字段已存在，无需初始化'
      }
    }
    
    // 初始化service_times字段
    const serviceTimes = {
      basic_60: 0,
      basic_90: 0,
      advanced_60: 0,
      advanced_90: 0
    }
    
    // 计算各项目次数总和
    const totalTimes = calculateTotalTimes(serviceTimes);
    
    // 更新用户数据
    await db.collection('users').doc(userId).update({
      data: {
        service_times: serviceTimes,
        remaining_times: totalTimes // 确保总次数一致
      }
    })
    
    return {
      success: true,
      message: 'service_times字段初始化成功'
    }
  } catch (error) {
    console.error('初始化service_times失败:', error)
    return {
      success: false,
      message: error.message || '初始化失败',
      error
    }
  }
}
 