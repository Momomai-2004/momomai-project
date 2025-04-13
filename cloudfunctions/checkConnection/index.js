// 云函数入口文件
const cloud = require('wx-server-sdk');

// 使用简单初始化
cloud.init();

// 云函数入口函数
exports.main = async (event, context) => {
  const startTime = Date.now();
  
  try {
    // 不检查特定集合存在性，而是列出所有集合
    const db = cloud.database();
    const collections = await db.collections();
    const collectionNames = collections.map(col => col.name);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    // 如果能获取集合列表，说明连接成功
    return {
      success: true,
      message: '云环境连接正常',
      responseTime: responseTime,
      collections: collectionNames,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // 捕获错误，返回失败信息
    console.error('云环境连接测试失败:', error);
    
    return {
      success: false,
      message: '云环境连接失败',
      error: error.message || '未知错误',
      timestamp: new Date().toISOString()
    };
  }
}; 