import * as categoryService from './category/category.service.js';
import * as indexService from './index/index.service.js';
import * as stockService from './stock/stock.service.js';
import * as dailyHistoryService from './daily-history/dailyHistory.service.js';
import * as priceHistoryService from './price-history/priceHistory.service.js';

export const marketService = {
  category: categoryService,
  index: indexService,
  stock: stockService,
  dailyHistory: dailyHistoryService,
  priceHistory: priceHistoryService
};

export default marketService;