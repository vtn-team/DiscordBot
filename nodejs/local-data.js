const fs = require('fs');
const path = require('path');

/**
 * ローカルJSONファイルの読み込み・保存を行うユーティリティ
 */
const LocalData = {
  /**
   * JSONファイルを読み込む
   * @param {string} file ファイル名
   * @param {string} dir ディレクトリ（デフォルト: カレント）
   * @returns {object|null} パースされたオブジェクト、またはnull
   */
  load(file, dir = '.') {
    try {
      const filePath = path.join(dir, file);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const json = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(json);
    } catch (err) {
      console.error(`Load ${file}:`, err.message);
      return null;
    }
  },

  /**
   * JSONファイルに保存する
   * @param {string} file ファイル名
   * @param {object} data 保存するデータ
   * @param {string} dir ディレクトリ（デフォルト: カレント）
   */
  save(file, data, dir = '.') {
    try {
      const filePath = path.join(dir, file);
      const dirPath = path.dirname(filePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error(`Save ${file}:`, err.message);
    }
  },

  /**
   * ファイルを削除する
   * @param {string} file ファイル名
   * @param {string} dir ディレクトリ（デフォルト: カレント）
   */
  delete(file, dir = '.') {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  },
};

module.exports = LocalData;
