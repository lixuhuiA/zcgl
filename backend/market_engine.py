import requests
import re
import json
import time
from datetime import datetime
from typing import List, Dict, Any

class MarketEngine:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Referer": "https://finance.qq.com/"
        }

    def _add_stock_prefix(self, code: str) -> str:
        code = str(code).strip()
        if not code.isdigit(): return code
        if code.startswith(('5', '6', '9')) or code.startswith('11'):
            return f"sh{code}"
        elif code.startswith(('0', '1', '3')):
            return f"sz{code}"
        elif code.startswith(('4', '8')):
            return f"bj{code}"
        return f"sh{code}"

    def get_real_time_data(self, stock_codes: List[str], fund_codes: List[str], source: str = "tencent") -> Dict[str, Any]:
        result = {
            "stocks": {},
            "funds": {}
        }

        # ==========================================================
        # 1. 股票部分 (保持不变，这部分是稳的)
        # ==========================================================
        if stock_codes:
            code_map = {self._add_stock_prefix(c): c for c in stock_codes}
            query_str = ",".join(code_map.keys())
            try:
                url = f"http://qt.gtimg.cn/q={query_str}"
                resp = requests.get(url, headers=self.headers, timeout=5)
                resp.encoding = 'gbk'
                content = resp.text
                matches = re.findall(r'v_([a-z]{2}\d+)="([^"]+)"', content)

                for key, data_str in matches:
                    data = data_str.split('~')
                    if len(data) > 30:
                        name = data[1]
                        current_price = float(data[3])
                        yesterday_close = float(data[4])
                        
                        if yesterday_close > 0:
                            change_percent = ((current_price - yesterday_close) / yesterday_close) * 100
                        else:
                            change_percent = float(data[32])

                        if current_price == 0 and yesterday_close > 0:
                            current_price = yesterday_close
                            change_percent = 0.0

                        original_code = code_map.get(key)
                        if original_code:
                            result["stocks"][original_code] = {
                                "name": name,
                                "price": current_price,
                                "change": change_percent
                            }
            except Exception as e:
                print(f"Stock Fetch Error: {e}")

        # ==========================================================
        # 2. 基金部分 (终极修复：双接口比对，确权净值优先)
        # ==========================================================
        timestamp = int(time.time() * 1000)
        # 获取当前日期 YYYY-MM-DD
        today_str = datetime.now().strftime('%Y-%m-%d')
        
        for code in fund_codes:
            clean_code = str(code).strip()
            
            # 定义两个数据容器
            data_realtime = None  # 方案A数据
            data_official = None  # 方案B数据

            # --- 步骤 1: 获取 A 接口 (实时估值) ---
            try:
                url = f"http://fundgz.1234567.com.cn/js/{clean_code}.js?rt={timestamp}"
                resp = requests.get(url, timeout=2)
                match = re.search(r'jsonpgz\((.*?)\);', resp.text)
                if match:
                    raw = json.loads(match.group(1))
                    data_realtime = {
                        "name": raw.get('name'),
                        "gsz": float(raw.get('gsz', 0)),
                        "dwjz": float(raw.get('dwjz', 0)),
                        "gszzl": float(raw.get('gszzl', 0)),
                        "jzrq": raw.get('jzrq', ''), # 净值日期
                        "gztime": raw.get('gztime', '') # 估值时间
                    }
            except:
                pass

            # --- 步骤 2: 获取 B 接口 (官方结算信息) ---
            # 无论 A 是否成功，为了保证晚间数据的绝对准确，必须尝试获取 B
            try:
                url_backup = f"http://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key={clean_code}"
                resp = requests.get(url_backup, timeout=3)
                if resp.status_code == 200:
                    raw = resp.json()
                    if "Datas" in raw and len(raw["Datas"]) > 0:
                        info = raw["Datas"][0]
                        if info.get("CODE") == clean_code:
                            base = info.get("FundBaseInfo", {})
                            data_official = {
                                "name": info.get("NAME"),
                                "dwjz": float(base.get("DWJZ", 0)), # 官方确权净值
                                "fsrq": base.get("FSRQ", "")        # 官方净值日期
                            }
            except:
                pass

            # --- 步骤 3: 终极裁决逻辑 (The Judge) ---
            final_data = None
            
            # 情况 1: 只有 A，没有 B -> 只能用 A
            if data_realtime and not data_official:
                price = data_realtime['gsz'] if data_realtime['gsz'] > 0 else data_realtime['dwjz']
                final_data = {
                    "name": data_realtime['name'],
                    "price": price,
                    "change": data_realtime['gszzl'],
                    "netValue": data_realtime['dwjz'],
                    "navDate": data_realtime['jzrq'],
                    "estimatedChange": data_realtime['gszzl']
                }

            # 情况 2: 只有 B，没有 A -> 只能用 B (通常是QDII或A接口挂了)
            elif data_official and not data_realtime:
                 final_data = {
                    "name": data_official['name'],
                    "price": data_official['dwjz'],
                    "change": 0, # B接口无实时涨跌
                    "netValue": data_official['dwjz'],
                    "navDate": data_official['fsrq'],
                    "estimatedChange": 0
                }

            # 情况 3: A 和 B 都有 -> 关键比对！
            elif data_realtime and data_official:
                # 核心逻辑：如果 B(官方) 的日期 >= A(实时) 的日期，说明官方已更新，必须用官方！
                # 或者，如果 B 的日期是今天，那绝对是用 B。
                use_official = False
                
                if data_official['fsrq'] > data_realtime['jzrq']:
                    use_official = True
                elif data_official['fsrq'] == today_str:
                    use_official = True
                
                if use_official:
                    # 使用官方确权数据
                    # 需要反推涨跌幅: (今日净值 - 昨日净值) / 昨日净值
                    # 由于我们没有直接的“昨日净值”，我们用 A 接口的“估值”反推“昨日收盘价”
                    # 昨收 ≈ 估值 / (1 + 估值涨幅%)
                    real_change = 0
                    try:
                        if data_realtime['gsz'] > 0:
                             last_close = data_realtime['gsz'] / (1 + data_realtime['gszzl'] / 100)
                             real_change = ((data_official['dwjz'] - last_close) / last_close) * 100
                    except:
                        real_change = 0

                    final_data = {
                        "name": data_official['name'],
                        "price": data_official['dwjz'], # 强制用官方净值
                        "change": real_change,          # 用反推的真实涨跌
                        "netValue": data_official['dwjz'],
                        "navDate": data_official['fsrq'],
                        "estimatedChange": real_change
                    }
                else:
                    # 官方还没更，还是盘中，或者A数据更新一点 -> 继续用 A 的估值
                    price = data_realtime['gsz'] if data_realtime['gsz'] > 0 else data_realtime['dwjz']
                    final_data = {
                        "name": data_realtime['name'],
                        "price": price,
                        "change": data_realtime['gszzl'],
                        "netValue": data_realtime['dwjz'],
                        "navDate": data_realtime['jzrq'],
                        "estimatedChange": data_realtime['gszzl']
                    }

            # --- 存入结果 ---
            if final_data:
                result["funds"][clean_code] = final_data

        return result