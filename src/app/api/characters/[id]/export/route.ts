import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 导出角色卡为xlsx格式
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token || undefined);

    // 从数据库获取角色数据
    const { data: character, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !character) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 动态导入xlsx库
    const XLSX = await import('xlsx');
    
    // 读取模板 - 尝试多个路径
    let templatePath = '/tmp/template.xlsx';
    
    // 尝试从项目 public 目录读取
    const publicTemplatePath = join(process.cwd(), 'public', 'template.xlsx');
    if (existsSync(publicTemplatePath)) {
      templatePath = publicTemplatePath;
    }
    // 尝试从工作目录读取
    else if (existsSync('/workspace/projects/public/template.xlsx')) {
      templatePath = '/workspace/projects/public/template.xlsx';
    }
    
    const workbook = XLSX.readFile(templatePath);
    
    // 获取人物卡工作表
    const sheet = workbook.Sheets['人物卡'];
    
    // 辅助函数：设置单元格值
    const setCell = (address: string, value: string | number) => {
      if (!sheet[address]) {
        sheet[address] = { t: typeof value === 'number' ? 'n' : 's', v: value };
      } else {
        sheet[address].v = value;
      }
    };
    
    // 填充基础信息
    setCell('K2', character.player_name || '匿名玩家');
    setCell('I4', character.name || '未命名');
    
    // 活跃力
    if (character.active_power) {
      setCell('E24', character.active_power);
    }
    
    // 种族
    setCell('C27', character.race || '人类');
    
    // 职业
    if (character.occupation) {
      setCell('C29', character.occupation);
    }
    
    // 年龄
    if (character.age) {
      setCell('C31', character.age);
    }
    
    // 性别
    if (character.gender) {
      setCell('E31', character.gender);
    }
    
    // 能力值
    const attrs = character.attributes as Record<string, number>;
    if (attrs) {
      // 肉体 Row 13
      setCell('H13', attrs.body || 0);
      setCell('I13', attrs.bodyRace || 0);
      setCell('J13', attrs.bodyJob || 0);
      setCell('K13', attrs.bodyNormal || 0);
      setCell('L13', attrs.bodyTransform || 0);
      
      // 运动 Row 15
      setCell('H15', attrs.athletics || 0);
      setCell('I15', attrs.athleticsRace || 0);
      setCell('J15', attrs.athleticsJob || 0);
      setCell('K15', attrs.athleticsNormal || 0);
      setCell('L15', attrs.athleticsTransform || 0);
      
      // 器用 Row 17
      setCell('H17', attrs.dexterity || 0);
      setCell('I17', attrs.dexterityRace || 0);
      setCell('J17', attrs.dexterityJob || 0);
      setCell('K17', attrs.dexterityNormal || 0);
      setCell('L17', attrs.dexterityTransform || 0);
      
      // 意志 Row 19
      setCell('H19', attrs.will || 0);
      setCell('I19', attrs.willRace || 0);
      setCell('J19', attrs.willJob || 0);
      setCell('K19', attrs.willNormal || 0);
      setCell('L19', attrs.willTransform || 0);
      
      // 机知 Row 21
      setCell('H21', attrs.wit || 0);
      setCell('I21', attrs.witRace || 0);
      setCell('J21', attrs.witJob || 0);
      setCell('K21', attrs.witNormal || 0);
      setCell('L21', attrs.witTransform || 0);
      
      // 移动力 Row 23
      setCell('H23', attrs.movement || 0);
      setCell('I23', attrs.movementRace || 0);
      setCell('J23', attrs.movementJob || 0);
      setCell('K23', attrs.movementNormal || 0);
      setCell('L23', attrs.movementTransform || 0);
      setCell('M23', attrs.movementBonus || 0);
      setCell('N23', attrs.movementBonus || 0);
      
      // 先制力 Row 25
      setCell('H25', attrs.initiative || 0);
      setCell('I25', attrs.initiativeRace || 0);
      setCell('J25', attrs.initiativeJob || 0);
      setCell('K25', attrs.initiativeNormal || 0);
      setCell('L25', attrs.initiativeTransform || 0);
      setCell('M25', attrs.initiativeBonus || 0);
      setCell('N25', attrs.initiativeBonus || 0);
      
      // 追加HP Row 27
      setCell('H27', attrs.additionalHP || 0);
      
      // 肉体HP Row 29
      setCell('H29', attrs.bodyHP || 20);
      setCell('K29', attrs.totalHP || 20);
      setCell('L29', attrs.transformHP || 45);
      setCell('M29', attrs.additionalHP || 0);
      setCell('N29', attrs.additionalHP || 0);
    }
    
    // 命运点数
    const fatePoints = character.fate_points as { points?: number; history?: string[] };
    if (fatePoints && fatePoints.points !== undefined) {
      setCell('M5', fatePoints.points);
    }
    
    // 武器
    const weapons = character.weapons as Array<{
      name?: string;
      range?: string;
      hit?: number;
      hitBonus?: number;
      hitTotal?: number;
      dp?: number;
      dpBonus?: number;
      dpTotal?: number;
      attribute?: string;
      uses?: number;
      note?: string;
    }>;
    
    if (weapons && weapons.length > 0) {
      weapons.forEach((weapon, idx) => {
        const row = 38 + idx * 2;
        if (row <= 44) {
          setCell(`B${row}`, weapon.name || '');
          setCell(`D${row}`, weapon.range || '');
          setCell(`E${row}`, weapon.hit || 0);
          setCell(`G${row}`, weapon.hitTotal || 0);
          setCell(`H${row}`, weapon.dp || 0);
          setCell(`J${row}`, weapon.dpTotal || 0);
          setCell(`K${row}`, weapon.attribute || '');
          setCell(`L${row}`, weapon.uses || 0);
          setCell(`M${row}`, weapon.note || '');
          
          // 右侧武器
          setCell(`P${row}`, weapon.name || '');
          setCell(`R${row}`, weapon.range || '');
          setCell(`S${row}`, weapon.hit || 0);
          setCell(`U${row}`, weapon.hitTotal || 0);
          setCell(`V${row}`, weapon.dp || 0);
          setCell(`X${row}`, weapon.dpTotal || 0);
          setCell(`Y${row}`, weapon.attribute || '');
          setCell(`Z${row}`, weapon.uses || 0);
        }
      });
    }
    
    // 防具
    const armors = character.armors as Array<{
      name?: string;
      dodge?: number;
      dodgeBonus?: number;
      dodgeTotal?: number;
      parry?: number;
      parryBonus?: number;
      parryTotal?: number;
      additionalHP?: number;
      fixed?: boolean;
      note?: string;
    }>;
    
    if (armors && armors.length > 0) {
      armors.forEach((armor, idx) => {
        const row = 51 + idx * 2;
        if (row <= 55) {
          setCell(`B${row}`, armor.name || '');
          setCell(`D${row}`, armor.dodge || 0);
          setCell(`F${row}`, armor.dodgeTotal || 0);
          setCell(`G${row}`, armor.parry || 0);
          setCell(`I${row}`, armor.parryTotal || 0);
          setCell(`J${row}`, armor.fixed ? '是' : '');
          setCell(`K${row}`, armor.additionalHP || 0);
          setCell(`L${row}`, armor.note || '');
          
          // 右侧防具
          setCell(`P${row}`, armor.name || '');
          setCell(`R${row}`, armor.dodge || 0);
          setCell(`T${row}`, armor.dodgeTotal || 0);
          setCell(`U${row}`, armor.parry || 0);
          setCell(`W${row}`, armor.parryTotal || 0);
          setCell(`X${row}`, armor.fixed ? '是' : '');
          setCell(`Y${row}`, armor.additionalHP || 0);
          setCell(`Z${row}`, armor.note || '');
        }
      });
    }
    
    // 其他装备
    if (character.other_equipment) {
      setCell('E59', character.other_equipment);
    }
    
    // 车辆
    const vehicle = character.vehicle as {
      name?: string;
      movement?: number;
      hp?: number;
      passengers?: number;
      dodge?: number;
      parry?: number;
      fatePoints?: number;
    };
    
    if (vehicle) {
      setCell('C61', vehicle.name || '');
      setCell('D60', vehicle.fatePoints || 0);
      setCell('F61', vehicle.movement || 0);
      setCell('H61', vehicle.hp || 0);
      setCell('J61', vehicle.passengers || 0);
      setCell('L61', vehicle.dodge || 0);
      setCell('N61', vehicle.parry || 0);
    }
    
    // 更新工作表范围
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z68');
    sheet['!ref'] = XLSX.utils.encode_range(range);
    
    // 更新背景页
    const bgSheet = workbook.Sheets['命運、活躍演技、行動原理、宿命、人物背景'];
    if (bgSheet && character.background) {
      // 将背景故事写入单元格
      XLSX.utils.sheet_add_aoa(bgSheet, [[character.background]], { origin: 'Q4' });
    }
    
    // 处理配置数据
    const configs = character.configs as Array<{
      category?: string;
      name?: string;
      level?: number;
      reference?: string;
    }>;
    
    if (configs && configs.length > 0) {
      // 配置从Row 6开始，每行一个配置
      let configRow = 6;
      configs.forEach((config) => {
        if (configRow <= 22) {
          // 根据类别确定位置
          const category = config.category || '';
          
          // 左侧配置列 (体质类配置)
          if (category.includes('体质') || category.includes('人类')) {
            setCell(`P${configRow}`, config.name || '');
            const levelStr = '●'.repeat(config.level || 0) + '○'.repeat(3 - (config.level || 0));
            setCell(`R${configRow}`, levelStr);
            setCell(`S${configRow}`, config.reference || '');
          }
          // 右侧配置列 (战斗类配置)
          else if (category.includes('战斗') || category.includes('种族')) {
            setCell(`U${configRow}`, config.category || '');
            setCell(`W${configRow}`, config.name || '');
            const levelStr = '●'.repeat(config.level || 0) + '○'.repeat(3 - (config.level || 0));
            setCell(`Y${configRow}`, levelStr);
            setCell(`Z${configRow}`, config.reference || '');
          }
          
          configRow++;
        }
      });
    }
    
    // 生成文件
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // 文件名编码处理
    const fileName = encodeURIComponent(`${character.name || 'character'}_character_sheet.xlsx`);
    
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('导出角色卡错误:', error);
    return NextResponse.json({ error: '导出失败' }, { status: 500 });
  }
}
