// 云函数createAdmin/index.js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 检查是否已存在管理员账号
    const adminCheck = await db.collection('users').where({
      userType: 'admin',
      phone: 'admin'
    }).count()
    
    if (adminCheck.total > 0) {
      // 已存在管理员账号，查询出来
      const adminData = await db.collection('users')
        .where({
          userType: 'admin',
          phone: 'admin'
        })
        .get()
      
      return {
        success: true,
        message: '管理员账号已存在',
        adminInfo: adminData.data[0]
      }
    }
    
    // 定义管理员服务次数
    const serviceTimes = {
      basic_60: 3,  // 基础拉伸60分钟
      basic_90: 2,  // 基础拉伸90分钟
      advanced_60: 3,  // 肌肉筋膜处理60分钟
      advanced_90: 2   // 肌肉筋膜处理90分钟
    }
    
    // 计算总次数（各项目次数之和）
    const totalTimes = Object.values(serviceTimes).reduce((sum, current) => sum + current, 0)
    
    // 创建管理员记录
    const result = await db.collection('users').add({
      data: {
        phone: 'admin',  // 管理员账号
        password: '1234567890', // 简单密码，实际应用中应加密
        userType: 'admin',
        nickName: '系统管理员',
        avatarUrl: '/images/admin-avatar.png',
        wallet_balance: 1000, // 钱包余额
        service_times: serviceTimes, // 服务次数明细
        remaining_times: totalTimes, // 总次数（自动计算）
        is_staff: true,
        is_admin: true,
        role: 'admin',
        // 兼容旧格式，同时添加旧格式的字段
        basic60Count: serviceTimes.basic_60,
        basic90Count: serviceTimes.basic_90, 
        advanced60Count: serviceTimes.advanced_60,
        advanced90Count: serviceTimes.advanced_90,
        create_time: db.serverDate(),
        update_time: db.serverDate()
      }
    })
    
    // 查询创建的管理员账号
    const adminInfo = await db.collection('users').doc(result._id).get()
    
    return {
      success: true,
      message: '管理员账号创建成功',
      adminInfo: adminInfo.data
    }
  } catch (error) {
    console.error('创建管理员账号失败:', error)
    return {
      success: false,
      message: '创建管理员账号失败',
      error: error
    }
  }
}