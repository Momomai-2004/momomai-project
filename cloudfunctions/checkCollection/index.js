// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database();
  
  try {
    // 获取要检查的集合名
    const collection = event.collection || '';
    
    if (!collection) {
      return {
        success: false,
        exists: false,
        error: '未提供集合名称'
      };
    }
    
    // 尝试查询该集合
    try {
      const result = await db.collection(collection).limit(1).get();
      // 如果没有抛出异常，说明集合存在
      return {
        success: true,
        exists: true,
        count: result.data.length
      };
    } catch (err) {
      // 检查是否是集合不存在的错误
      if (err.errCode === -502005 || 
          (err.errMsg && err.errMsg.includes('collection not exists'))) {
        return {
          success: true,
          exists: false,
          error: '集合不存在'
        };
      }
      
      // 其他错误
      return {
        success: false,
        exists: false,
        error: err.errMsg || '未知错误'
      };
    }
  } catch (error) {
    return {
      success: false,
      exists: false,
      error: error.message || '执行失败'
    };
  }
} 