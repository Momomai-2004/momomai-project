// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const db = cloud.database();
  
  try {
    // 获取订单列表和要更新的数据
    const { orders, updateData } = event;
    
    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return {
        success: false,
        error: '未提供有效的订单列表'
      }
    }
    
    if (!updateData) {
      return {
        success: false,
        error: '未提供要更新的数据'
      }
    }
    
    const results = [];
    
    // 处理每个订单
    for (const order of orders) {
      try {
        const collectionName = order.collection || 'appointments';
        const orderId = order.id;
        
        if (!orderId) {
          results.push({
            id: 'unknown',
            success: false,
            message: '订单ID缺失'
          });
          continue;
        }
        
        // 更新订单状态
        const updateResult = await db.collection(collectionName)
          .doc(orderId)
          .update({
            data: updateData
          });
        
        results.push({
          id: orderId,
          success: true,
          updated: updateResult.stats.updated,
          collection: collectionName
        });
        
        console.log(`成功更新订单 ${orderId} 在 ${collectionName} 集合中，结果:`, updateResult);
      } catch (err) {
        console.error(`更新订单 ${order.id} 失败:`, err);
        results.push({
          id: order.id,
          success: false,
          message: err.message || '更新失败',
          collection: order.collection
        });
      }
    }
    
    return {
      success: true,
      updated: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      total: orders.length,
      results: results
    }
  } catch (err) {
    console.error('批量更新订单发生错误:', err);
    return {
      success: false,
      error: err.message || '执行失败'
    }
  }
} 