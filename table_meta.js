const { MongoClient } = require('mongodb');

// MongoDB类型映射到自定义字段类型
const TYPE_MAPPING = {
  'string': 1,
  'number': 2,
  'boolean': 7,
  'date': 5,
  'object': 13,
  'array': 14
};

/**
 * 从MongoDB获取表格元数据
 * @param {Object} params - MongoDB连接参数
 * @param {string} params.MONGODB_HOST - MongoDB主机
 * @param {string} params.MONGODB_PORT - MongoDB端口
 * @param {string} params.MONGODB_USERNAME - MongoDB用户名
 * @param {string} params.MONGODB_PASSWORD - MongoDB密码
 * @param {string} params.MONGODB_NAME - MongoDB数据库名
 * @param {string} params.TABLE_NAME - 表名(集合名)
 * @returns {Promise<Object>} 表格元数据
 */
const getTableMeta = async (params) => {
  const {
    MONGODB_HOST,
    MONGODB_PORT,
    MONGODB_USERNAME,
    MONGODB_PASSWORD,
    MONGODB_NAME,
    TABLE_NAME
  } = params;

  // 构建MongoDB连接字符串
  const auth = MONGODB_USERNAME && MONGODB_PASSWORD
    ? `${encodeURIComponent(MONGODB_USERNAME)}:${encodeURIComponent(MONGODB_PASSWORD)}@`
    : '';
  // 添加authSource参数，默认为admin，可根据需要修改
  const uri = `mongodb://${auth}${MONGODB_HOST}:${MONGODB_PORT}/${MONGODB_NAME}?authSource=admin`;

  let client;
  try {
    // 连接MongoDB
    client = new MongoClient(uri);
    await client.connect();

    // 获取数据库和集合
    const db = client.db(MONGODB_NAME);
    const collection = db.collection(TABLE_NAME);

    // 获取集合中的文档样例，用于推断字段类型
    const sampleDocuments = await collection.find({}).limit(10).toArray();

    // 如果没有文档，返回空结构
    if (sampleDocuments.length === 0) {
      return {
        tableName: TABLE_NAME,
        fields: []
      };
    }

    // 分析字段和类型
    const fields = [];
    const fieldTypes = new Map();

    // 遍历文档样例，收集字段类型信息
    sampleDocuments.forEach(doc => {
      Object.entries(doc).forEach(([fieldName, value]) => {
        // 跳过_id字段
        if (fieldName === '_id') return;

        let type;
        if (value === null) {
          type = 'null';
        } else if (Array.isArray(value)) {
          type = 'array';
        } else if (value instanceof Date) {
          type = 'date';
        } else {
          type = typeof value;
        }

        // 如果字段已经存在，确保类型一致
        if (fieldTypes.has(fieldName)) {
          if (fieldTypes.get(fieldName) !== type && type !== 'null') {
            // 如果类型不一致且不是null，使用更通用的类型
            fieldTypes.set(fieldName, 'object');
          }
        } else {
          fieldTypes.set(fieldName, type);
        }
      });
    });

    // 构建字段信息
    let fieldIdCounter = 1;
    fieldTypes.forEach((type, fieldName) => {
      // 映射MongoDB类型到自定义字段类型
      const fieldType = TYPE_MAPPING[type] || 13; // 默认使用对象类型

      fields.push({
        fieldId: `fid_${fieldIdCounter++}`,
        fieldName: fieldName,
        fieldType: fieldType,
        isPrimary: fieldName === 'id' || fieldName === '_id',
        description: '',
        property: {}
      });
    });

    return {
      tableName: TABLE_NAME,
      fields: fields
    };
  } catch (error) {
    const detailedError = `Failed to get table metadata from MongoDB: ${error.message}`;
    console.error('Error connecting to MongoDB or fetching metadata:', error);
    throw new Error(detailedError);
  } finally {
    // 关闭连接
    if (client) {
      await client.close();
    }
  }
};

module.exports = { getTableMeta };

// 导出供测试使用
if (require.main === module) {
  // 测试参数
  const testParams = {
    MONGODB_HOST: 'localhost',
    MONGODB_PORT: '27017',
    MONGODB_USERNAME: '',
    MONGODB_PASSWORD: '',
    MONGODB_NAME: 'test',
    TABLE_NAME: 'users'
  };

  // 测试函数
  async function test() {
    try {
      const meta = await getTableMeta(testParams);
      console.log('Table Meta:', JSON.stringify(meta, null, 2));
    } catch (error) {
      console.error('Test failed:', error);
    }
  }

  test();
}
