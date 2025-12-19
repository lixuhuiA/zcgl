import requests
import datetime

class MarketEngine:
    def __init__(self):
        self.sources = {
            "sina": "http://hq.sinajs.cn/list=",
            "tencent": "http://qt.gtimg.cn/q="
        }

    # --- 【关键修复】智能识别交易所前缀 ---
    def _get_prefix(self, code):
        # 6开头(主板), 5开头(ETF/基金), 9开头(B股) -> 上海 sh
        if code.startswith(('5', '6', '9')):
            return f"sh{code}"
        # 0开头(主板), 3开头(创业板), 1开头(ETF/基金) -> 深圳 sz
        elif code.startswith(('0', '1', '3')):
            return f"sz{code}"
        # 4/8开头 -> 北交所 bj (新浪接口支持 bj)
        elif code.startswith(('4', '8')):
            return f"bj{code}"
        # 默认回落到 sh (防止漏网)
        return f"sh{code}"

    def get_real_time_data(self, stock_codes, fund_codes, source='sina'):
        results = {
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            "stocks": {},
            "funds": {}
        }
        
        # 1. 股票/ETF处理
        if stock_codes:
            # 使用修复后的前缀逻辑
            formatted_codes = [self._get_prefix(c) for c in stock_codes]
            
            if source == 'tencent':
                self._fetch_tencent(formatted_codes, results['stocks'])
            else:
                self._fetch_sina(formatted_codes, results['stocks'])

        # 2. 基金处理 (保持不变)
        if fund_codes:
            sina_fund_codes = [f"f_{code}" for code in fund_codes]
            self._fetch_sina_fund(sina_fund_codes, results['funds'])

        return results

    def _fetch_sina(self, codes, result_dict):
        try:
            url = self.sources['sina'] + ",".join(codes)
            headers = {"Referer": "https://finance.sina.com.cn/"}
            resp = requests.get(url, headers=headers, timeout=3)
            
            lines = resp.text.splitlines()
            for line in lines:
                if '="' in line:
                    parts = line.split('="')
                    # 解析代码: var hq_str_sh513100 -> 513100
                    code_with_prefix = parts[0].split('_')[-1]
                    code = code_with_prefix[2:] 
                    
                    data = parts[1].strip('";').split(',')
                    if len(data) > 3:
                        price = float(data[3])
                        prev_close = float(data[2])
                        # 修复：如果是停牌或集合竞价可能为0
                        if price == 0 and prev_close > 0: price = prev_close
                        
                        change_percent = ((price - prev_close) / prev_close) * 100 if prev_close > 0 else 0
                        
                        result_dict[code] = {
                            "price": price,
                            "change": round(change_percent, 2)
                        }
        except Exception as e:
            print(f"[Error] Sina fetch: {e}")

    def _fetch_tencent(self, codes, result_dict):
        try:
            url = self.sources['tencent'] + ",".join(codes)
            resp = requests.get(url, timeout=3)
            lines = resp.text.splitlines()
            for line in lines:
                if '="' in line:
                    parts = line.split('="')
                    code_full = parts[0].split('_')[-1] 
                    code = code_full[2:]
                    data = parts[1].strip('";').split('~')
                    if len(data) > 32:
                        price = float(data[3])
                        change_percent = float(data[32])
                        result_dict[code] = {
                            "price": price,
                            "change": round(change_percent, 2)
                        }
        except Exception as e:
            print(f"[Error] Tencent fetch: {e}")

    def _fetch_sina_fund(self, codes, result_dict):
        try:
            url = "http://hq.sinajs.cn/list=" + ",".join(codes)
            resp = requests.get(url, timeout=3)
            lines = resp.text.splitlines()
            for line in lines:
                if '="' in line:
                    parts = line.split('="')
                    code = parts[0].split('_')[-1]
                    data = parts[1].strip('";').split(',')
                    if len(data) > 1:
                        nav = float(data[1])
                        result_dict[code] = { "nav": nav, "change": 0 }
        except: pass