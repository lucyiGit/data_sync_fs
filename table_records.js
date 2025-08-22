const { MongoClient } = require('mongodb');

/**
 * 从MongoDB获取表格记录
 * @param {Object} params - 包含MongoDB连接参数和查询参数
 * @returns {Promise<Object>} 表格记录数据
 */
const getTableRecords = async (params) => {
  // 解析参数
  const { datasourceConfig, pageToken = '', maxPageSize = 100 } = params;

  // 验证并解析datasourceConfig
  let dbConfig, fieldMappings;
  try {
    // 检查datasourceConfig是否已经是对象
    if (typeof datasourceConfig === 'object' && datasourceConfig !== null) {
      ({ dbConfig, fieldMappings } = datasourceConfig);
    } else if (typeof datasourceConfig === 'string') {
      // 如果是字符串，则尝试解析
      const parsedConfig = JSON.parse(datasourceConfig);
      dbConfig = parsedConfig.dbConfig;
      fieldMappings = parsedConfig.fieldMappings;
    } else {
      throw new Error('datasourceConfig must be a valid JSON string or object');
    }
    // 验证必要的配置是否存在
    if (!dbConfig || !fieldMappings) {
      throw new Error('datasourceConfig is missing required fields: dbConfig or fieldMappings');
    }
  } catch (error) {
    throw new Error(`Failed to parse datasourceConfig: ${error.message}`);
  }
  const {
    MONGODB_HOST,
    MONGODB_PORT,
    MONGODB_USERNAME,
    MONGODB_PASSWORD,
    MONGODB_NAME,
    TABLE_NAME
  } = dbConfig;

  // 构建MongoDB连接字符串
  const auth = MONGODB_USERNAME && MONGODB_PASSWORD
    ? `${encodeURIComponent(MONGODB_USERNAME)}:${encodeURIComponent(MONGODB_PASSWORD)}@`
    : '';
  const uri = `mongodb://${auth}${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_NAME}?authSource=admin`;

  let client;
  try {
    // 连接MongoDB
    client = new MongoClient(uri);
    await client.connect();

    // 获取数据库和集合
    const db = client.db(MONGODB_NAME);
    const collection = db.collection(TABLE_NAME);

    // 构建查询
    let query = {};
    if (pageToken) {
      // 实现分页逻辑，这里假设pageToken是上一页最后一条记录的_id
      query = { _id: { $gt: pageToken } };
    }

    // 查询数据
    const cursor = collection.find(query).limit(parseInt(maxPageSize) + 1); // +1用于检查是否有更多数据
    const documents = await cursor.toArray();

    // 处理分页
    const hasMore = documents.length > parseInt(maxPageSize);
    const recordsToReturn = hasMore ? documents.slice(0, parseInt(maxPageSize)) : documents;
    const nextPageToken = hasMore ? recordsToReturn[recordsToReturn.length - 1]._id.toString() : '';

    // 构建返回结果
    const records = recordsToReturn.map(doc => {
      const record = {
        primaryId: doc._id.toString(),
        data: {}
      };

      // 根据fieldMappings映射字段
      fieldMappings.forEach(mapping => {
        if (mapping.enabled) {
          const { sourceFieldId, sourceFieldName } = mapping;
          // 尝试从文档中获取字段值
          let value = doc[sourceFieldName] || doc[sourceFieldId];

          // 类型映射处理函数
          const typeHandlers = {
            1: (val) => val, // 类型1：文本
            2: (val) => Number(val), // 类型2：数字
            3: (val) => val, // 类型3：单选
            4: (val) => Array.isArray(val) ? val : [val], // 类型4：多选
            5: (val) => val instanceof Date ? val.getTime() : val, // 类型5：日期
            6: (val) => String(val), // 类型6：条形码
            7: (val) => Boolean(val), // 类型7：复选框
            8: (val) => Number(val), // 类型8：货币
            9: (val) => String(val), // 类型9：电话
            10: (val) => String(val), // 类型10：URL
            11: (val) => Number(val), // 类型11：进度
            12: (val) => Number(val) // 类型12：评分
          };

          // 根据targetFieldType处理值
          const { targetFieldType } = mapping;
          if (targetFieldType && typeHandlers[targetFieldType]) {
            value = typeHandlers[targetFieldType](value);
          } else if (value instanceof Date) {
            value = value.getTime(); // 转换为时间戳
          }

          // 设置到结果中
          record.data[sourceFieldId] = value;
        }
      });

      return record;
    });

    return {
      nextPageToken,
      hasMore,
      records
    };
  } catch (error) {
    const detailedError = `Failed to get table records from MongoDB: ${error.message}`;
    console.error('Error connecting to MongoDB or fetching records:', error);
    throw new Error(detailedError);
  } finally {
    // 关闭连接
    if (client) {
      await client.close();
    }
  }
};

module.exports = { getTableRecords };
