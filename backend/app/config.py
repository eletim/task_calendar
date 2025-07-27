# app/config.py
import os

class DevelopmentConfig:
    DEBUG = True
    # 他の開発用設定…

class ProductionConfig:
    DEBUG = False
    # 他の本番用設定…

config_map = {
    'development': DevelopmentConfig,
    'production':  ProductionConfig,
}
