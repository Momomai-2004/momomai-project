// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const $ = db.command.aggregate

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
  const { userId, syncAll = false } = event
  
  try {
    // 如果提供了特定用户ID，只同步该用户的数据
    if (userId) {
      return await syncSingleMember(userId)
    }
    
    // 如果没有指定用户ID且syncAll为true，同步所有用户
    if (syncAll) {
      return await syncAllMembers()
    }
    
    // 默认情况下，仅同步有问题的用户数据
    return await syncInconsistentMembers()
  } catch (error) {
    console.error('同步会员次数失败:', error)
    return {
      success: false,
      message: error.message || '同步会员次数失败',
      error
    }
  }
}

// 同步单个会员
async function syncSingleMember(userId) {
  // 获取会员信息
  const userRes = await db.collection('users').doc(userId).get()
  const userData = userRes.data
  
  if (!userData) {
    return {
      success: false,
      message: '未找到会员信息'
    }
  }
  
  // 检查是否有旧格式次数字段
  const hasOldFormat = typeof userData.basic60Count !== 'undefined' || 
                       typeof userData.basic90Count !== 'undefined' || 
                       typeof userData.advanced60Count !== 'undefined' || 
                       typeof userData.advanced90Count !== 'undefined';
                       
  let needsUpdate = false;
  
  // 确保service_times字段存在
  if (!userData.service_times) {
    userData.service_times = {
      basic_60: 0,
      basic_90: 0,
      advanced_60: 0,
      advanced_90: 0
    }
    
    // 如果有旧数据，进行迁移
    if (hasOldFormat) {
      userData.service_times.basic_60 = userData.basic60Count || 0;
      userData.service_times.basic_90 = userData.basic90Count || 0;
      userData.service_times.advanced_60 = userData.advanced60Count || 0;
      userData.service_times.advanced_90 = userData.advanced90Count || 0;
    }
    
    needsUpdate = true;
  }
  
  // 计算总次数
  const totalTimes = calculateTotalTimes(userData.service_times)
  
  // 如果总次数不一致或需要更新service_times，则更新数据
  if (userData.remaining_times !== totalTimes || needsUpdate) {
    const updateData = {
      remaining_times: totalTimes,
      update_time: db.serverDate()
    };
    
    // 如果需要更新service_times，添加到更新数据中
    if (needsUpdate) {
      updateData.service_times = userData.service_times;
    }
    
    // 更新用户数据
    await db.collection('users').doc(userId).update({
      data: updateData
    });
    
    return {
      success: true,
      message: '会员次数已同步',
      userId,
      oldTotalTimes: userData.remaining_times,
      newTotalTimes: totalTimes,
      updatedServiceTimes: needsUpdate
    };
  }
  
  return {
    success: true,
    message: '会员次数已同步（无需更新）',
    userId,
    totalTimes
  };
}

// 同步所有会员
async function syncAllMembers() {
  // 获取所有非员工用户
  const userList = await db.collection('users')
    .where({
      is_staff: _.neq(true)
    })
    .get()
  
  const users = userList.data
  const results = []
  let updatedCount = 0
  
  // 逐个同步
  for (const user of users) {
    // 检查是否有旧格式次数字段
    const hasOldFormat = typeof user.basic60Count !== 'undefined' || 
                         typeof user.basic90Count !== 'undefined' || 
                         typeof user.advanced60Count !== 'undefined' || 
                         typeof user.advanced90Count !== 'undefined';
    
    let needsUpdate = false;
    
    // 确保service_times字段存在
    if (!user.service_times) {
      user.service_times = {
        basic_60: 0,
        basic_90: 0,
        advanced_60: 0,
        advanced_90: 0
      }
      
      // 如果有旧数据，进行迁移
      if (hasOldFormat) {
        user.service_times.basic_60 = user.basic60Count || 0;
        user.service_times.basic_90 = user.basic90Count || 0;
        user.service_times.advanced_60 = user.advanced60Count || 0;
        user.service_times.advanced_90 = user.advanced90Count || 0;
      }
      
      needsUpdate = true;
    }
    
    // 计算总次数
    const totalTimes = calculateTotalTimes(user.service_times)
    
    // 如果总次数不一致或需要更新service_times，则更新数据
    if (user.remaining_times !== totalTimes || needsUpdate) {
      const updateData = {
        remaining_times: totalTimes,
        update_time: db.serverDate()
      };
      
      // 如果需要更新service_times，添加到更新数据中
      if (needsUpdate) {
        updateData.service_times = user.service_times;
      }
      
      // 更新用户数据
      await db.collection('users').doc(user._id).update({
        data: updateData
      });
      
      results.push({
        userId: user._id,
        oldTotalTimes: user.remaining_times,
        newTotalTimes: totalTimes,
        updatedServiceTimes: needsUpdate
      });
      
      updatedCount++;
    }
  }
  
  return {
    success: true,
    message: `已同步 ${updatedCount}/${users.length} 个会员的次数数据`,
    updatedUsers: results
  }
}

// 只同步不一致的会员数据
async function syncInconsistentMembers() {
  // 查询所有会员
  const userList = await db.collection('users')
    .where({
      is_staff: _.neq(true)
    })
    .get()
  
  const users = userList.data
  const results = []
  let updatedCount = 0
  
  // 找出需要同步的会员
  for (const user of users) {
    // 检查是否有旧格式次数字段
    const hasOldFormat = typeof user.basic60Count !== 'undefined' || 
                         typeof user.basic90Count !== 'undefined' || 
                         typeof user.advanced60Count !== 'undefined' || 
                         typeof user.advanced90Count !== 'undefined';
    
    let needsUpdate = false;
    
    // 确保service_times字段存在
    if (!user.service_times) {
      user.service_times = {
        basic_60: 0,
        basic_90: 0,
        advanced_60: 0,
        advanced_90: 0
      }
      
      // 如果有旧数据，进行迁移
      if (hasOldFormat) {
        user.service_times.basic_60 = user.basic60Count || 0;
        user.service_times.basic_90 = user.basic90Count || 0;
        user.service_times.advanced_60 = user.advanced60Count || 0;
        user.service_times.advanced_90 = user.advanced90Count || 0;
      }
      
      needsUpdate = true;
    }
    
    // 计算总次数
    const totalTimes = calculateTotalTimes(user.service_times)
    
    // 检查总次数是否一致或需要更新service_times
    if (user.remaining_times !== totalTimes || needsUpdate) {
      const updateData = {
        remaining_times: totalTimes,
        update_time: db.serverDate()
      };
      
      // 如果需要更新service_times，添加到更新数据中
      if (needsUpdate) {
        updateData.service_times = user.service_times;
      }
      
      await db.collection('users').doc(user._id).update({
        data: updateData
      })
      
      results.push({
        userId: user._id,
        oldTotalTimes: user.remaining_times,
        newTotalTimes: totalTimes,
        updatedServiceTimes: needsUpdate
      })
      
      updatedCount++
    }
  }
  
  return {
    success: true,
    message: `已同步 ${updatedCount} 个不一致的会员数据`,
    updatedUsers: results
  }
} 