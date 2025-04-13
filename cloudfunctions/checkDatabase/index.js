// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: 'chilling-4gdawl4ea811c0cd' // 使用确切的环境ID
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { collection, limit = 5 } = event;
  
  if (!collection) {
    return {
      success: false,
      errMsg: '缺少集合名参数'
    };
  }
  
  try {
    // 获取集合总记录数
    const countResult = await db.collection(collection).count();
    const total = countResult.total;
    
    // 获取示例数据
    const dataResult = await db.collection(collection)
      .limit(limit)
      .get();
    
    return {
      success: true,
      total,
      data: dataResult.data,
      collection
    };
  } catch (error) {
    console.error('数据库检查失败:', error);
    return {
      success: false,
      errMsg: error.message || '数据库检查失败',
      error
    };
  }
}; 