import * as categoryService from './category/category.service.js';
import * as indexService from './index/index.service.js';
import * as stockService from './stock/stock.service.js';
import * as dailyHistoryService from './daily-history/dailyHistory.service.js';
import * as priceHistoryService from './price-history/priceHistory.service.js';
import * as interestSlabService from './interest-slab/interestSlab.service.js';
import * as investmentService from './investment/investment.service.js';

export const marketService = {
  category: categoryService,
  index: indexService,
  stock: stockService,
  dailyHistory: dailyHistoryService,
  priceHistory: priceHistoryService,
  interestSlab: interestSlabService,
  investment: investmentService,
};

export default marketService;