// Конфигурация
const API_URL = '/api/';
const ITEMS_PER_PAGE = 10;
const DEFAULT_REFRESH_INTERVAL = 1000; // 1 секунда

// Переменные для состояния
let catsArray = [];
let currentSort = 'cats_desc';
let currentFilter = 'all';
let currentSearch = '';
let currentPage = 1;
let refreshInterval = DEFAULT_REFRESH_INTERVAL;
let autoRefreshEnabled = true;
let autoRefreshTimer = null;
let prestigeChart = null;

// DOM элементы
const tableBody = document.getElementById('tableBody');
const pagination = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const filterSelect = document.getElementById('filterSelect');
const totalCatsElement = document.getElementById('total-cats');
const totalAttacksElement = document.getElementById('total-attacks');
const avgSuccessElement = document.getElementById('avg-success');
const totalMatroskinElement = document.getElementById('total-matroskin');
const totalRecordsElement = document.getElementById('totalRecords');
const updateDateElement = document.getElementById('updateDate');
const loadingElement = document.getElementById('loading');
const refreshBtn = document.getElementById('refreshBtn');
const toggleAutoRefreshBtn = document.getElementById('toggleAutoRefresh');
const autoRefreshStatus = document.getElementById('autoRefreshStatus');
const refreshIntervalElement = document.getElementById('refreshInterval');
const changeIntervalBtn = document.getElementById('changeIntervalBtn');
const intervalModal = document.getElementById('intervalModal');
const applyIntervalBtn = document.getElementById('applyInterval');
const cancelIntervalBtn = document.getElementById('cancelInterval');
const topPrestigeList = document.getElementById('topPrestigeList');
const prestigeLegend = document.getElementById('prestigeLegend');

// Цвета для уровней престижа
const PRESTIGE_COLORS = {
    0: '#a5b1c2', // Серый
    1: '#78e08f', // Зеленый
    2: '#4a69bd', // Синий
    3: '#f8c291', // Оранжевый
    4: '#e55039', // Красный
    5: '#8e44ad', // Фиолетовый
    6: '#f6b93b', // Желтый
    7: '#38ada9', // Бирюзовый
    8: '#6a89cc', // Светло-синий
    9: '#b8e994', // Светло-зеленый
    10: '#fa983a' // Темно-оранжевый
};

// Инициализация
async function init() {
    showLoading(true);
    try {
        await loadData();
        calculateStats();
        updatePrestigeChart();
        updateTopPrestigeList();
        updateTable();
        setupEventListeners();
        startAutoRefresh();
        updateDateElement.textContent = new Date().toLocaleString('ru-RU');
    } catch (error) {
        showError('Ошибка при загрузке данных с сервера');
        console.error('Error loading data:', error);
    } finally {
        showLoading(false);
    }
}

// Загрузка данных с сервера
async function loadData() {
    try {
        console.log(`Загружаю данные с ${API_URL}`, new Date().toLocaleTimeString());
        const response = await fetch(API_URL, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Получены данные:', data);
        
        // Проверяем формат данных
        if (typeof data !== 'object' || data === null) {
            throw new Error('Некорректный формат данных с сервера');
        }
        
        // Преобразование данных в массив
        catsArray = [];
        
        // Если данные уже в формате массива
        if (Array.isArray(data)) {
            catsArray = data.map((item, index) => {
                return {
                    id: item.id || `item_${index}`,
                    ...item
                };
            });
        } 
        // Если данные в формате объекта
        else {
            for (const [id, catData] of Object.entries(data)) {
                catsArray.push({
                    id,
                    ...catData
                });
            }
        }
        
        console.log(`Загружено ${catsArray.length} записей`);
        
        // Сохраняем данные в localStorage
        try {
            localStorage.setItem('catsData', JSON.stringify(catsArray));
            localStorage.setItem('catsDataTimestamp', new Date().toISOString());
        } catch (e) {
            console.warn('Не удалось сохранить данные в localStorage:', e);
        }
        
        // Обновляем время последнего обновления
        updateDateElement.textContent = new Date().toLocaleString('ru-RU');
        
    } catch (error) {
        console.error('Error fetching data:', error);
        
        // Пробуем загрузить из localStorage
        try {
            const cachedData = localStorage.getItem('catsData');
            const cachedTimestamp = localStorage.getItem('catsDataTimestamp');
            
            if (cachedData) {
                console.log('Использую кэшированные данные из localStorage');
                catsArray = JSON.parse(cachedData);
                
                if (cachedTimestamp) {
                    updateDateElement.textContent = `Кэш: ${new Date(cachedTimestamp).toLocaleString('ru-RU')}`;
                }
                
                return;
            }
        } catch (e) {
            console.warn('Ошибка при чтении из localStorage:', e);
        }
        
        throw error;
    }
}

// Обновление данных с сервера
async function refreshData() {
    if (!autoRefreshEnabled) return;
    
    try {
        await loadData();
        calculateStats();
        updatePrestigeChart();
        updateTopPrestigeList();
        updateTable();
        console.log('Данные обновлены:', new Date().toLocaleTimeString());
    } catch (error) {
        console.error('Error refreshing data:', error);
        // Не показываем ошибку пользователю при автообновлении
    }
}

// Запуск автообновления
function startAutoRefresh() {
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    
    if (autoRefreshEnabled) {
        autoRefreshTimer = setInterval(refreshData, refreshInterval);
        console.log(`Автообновление запущено с интервалом ${refreshInterval}ms`);
    }
}

// Переключение автообновления
function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    
    if (autoRefreshEnabled) {
        autoRefreshStatus.textContent = 'Включено';
        autoRefreshStatus.className = 'status-active';
        toggleAutoRefreshBtn.innerHTML = '<i class="fas fa-pause"></i> Пауза автообновления';
        startAutoRefresh();
    } else {
        autoRefreshStatus.textContent = 'Выключено';
        autoRefreshStatus.className = 'status-paused';
        toggleAutoRefreshBtn.innerHTML = '<i class="fas fa-play"></i> Возобновить автообновление';
        
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
    }
}

// Изменение интервала обновления
function changeRefreshInterval(newInterval) {
    refreshInterval = newInterval;
    refreshIntervalElement.textContent = refreshInterval / 1000;
    
    if (autoRefreshEnabled) {
        startAutoRefresh();
    }
}

// Показать/скрыть индикатор загрузки
function showLoading(show) {
    loadingElement.style.display = show ? 'block' : 'none';
}

// Показать сообщение об ошибке
function showError(message) {
    const errorHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>${message}</p>
            <button id="retryBtn" class="refresh-btn" style="margin-top: 15px;">
                <i class="fas fa-redo"></i> Попробовать снова
            </button>
        </div>
    `;
    
    document.querySelector('.container').insertAdjacentHTML('beforeend', errorHTML);
    
    document.getElementById('retryBtn')?.addEventListener('click', async () => {
        document.querySelector('.error-message')?.remove();
        await init();
    });
}

// Расчет общей статистики
function calculateStats() {
    let totalCats = 0;
    let totalAttacks = 0;
    let totalSuccessfulAttacks = 0;
    let totalMatroskin = 0;
    let count = catsArray.length;

    catsArray.forEach(cat => {
        totalCats += cat.cats || 0;
        totalAttacks += cat.attacks || 0;
        totalSuccessfulAttacks += cat.successful_attacks || 0;
        totalMatroskin += cat.matroskin || 0;
    });

    const avgSuccess = totalAttacks > 0 ? Math.round((totalSuccessfulAttacks / totalAttacks) * 100) : 0;

    totalCatsElement.textContent = totalCats.toLocaleString();
    totalAttacksElement.textContent = totalAttacks.toLocaleString();
    avgSuccessElement.textContent = `${avgSuccess}%`;
    totalMatroskinElement.textContent = totalMatroskin.toLocaleString();
    totalRecordsElement.textContent = count;
}

// Расчет статистики престижей
function calculatePrestigeStats() {
    const prestigeStats = {};
    let totalWithPrestige = 0;
    
    catsArray.forEach(cat => {
        const prestigeLevel = cat.prestige_level || 0;
        
        if (!prestigeStats[prestigeLevel]) {
            prestigeStats[prestigeLevel] = {
                count: 0,
                users: []
            };
        }
        
        prestigeStats[prestigeLevel].count++;
        prestigeStats[prestigeLevel].users.push({
            name: cat.name || cat.nickname || 'Неизвестно',
            id: cat.id,
            prestige: prestigeLevel,
            cats: cat.cats || 0
        });
        
        if (prestigeLevel > 0) {
            totalWithPrestige++;
        }
    });
    
    return { prestigeStats, totalWithPrestige };
}

// Создание/обновление круговой диаграммы престижей
function updatePrestigeChart() {
    const ctx = document.getElementById('prestigeChart').getContext('2d');
    const { prestigeStats } = calculatePrestigeStats();
    
    // Подготовка данных для диаграммы
    const labels = [];
    const data = [];
    const backgroundColors = [];
    const borderColors = [];
    
    // Сортируем по уровню престижа
    const sortedLevels = Object.keys(prestigeStats).sort((a, b) => parseInt(a) - parseInt(b));
    
    sortedLevels.forEach(level => {
        const count = prestigeStats[level].count;
        if (count > 0) {
            labels.push(`Престиж ${level}`);
            data.push(count);
            
            const color = PRESTIGE_COLORS[level] || PRESTIGE_COLORS[0];
            backgroundColors.push(color);
            borderColors.push(color.replace('0.6', '1'));
        }
    });
    
    // Уничтожаем старую диаграмму, если существует
    if (prestigeChart) {
        prestigeChart.destroy();
    }
    
    // Создаем новую диаграмму
    prestigeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Скрываем стандартную легенду
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
    
    // Обновляем кастомную легенду
    updatePrestigeLegend(sortedLevels, prestigeStats);
}

// Обновление кастомной легенды
function updatePrestigeLegend(levels, prestigeStats) {
    let legendHTML = '';
    
    levels.forEach(level => {
        const count = prestigeStats[level].count;
        if (count > 0) {
            const color = PRESTIGE_COLORS[level] || PRESTIGE_COLORS[0];
            const percentage = Math.round((count / catsArray.length) * 100);
            
            legendHTML += `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${color};"></div>
                    <div class="legend-text">
                        <strong>Престиж ${level}:</strong> ${count} (${percentage}%)
                    </div>
                </div>
            `;
        }
    });
    
    prestigeLegend.innerHTML = legendHTML;
}

// Обновление списка топ престижей
function updateTopPrestigeList() {
    const { prestigeStats } = calculatePrestigeStats();
    
    // Собираем всех пользователей с престижем
    let allUsers = [];
    Object.keys(prestigeStats).forEach(level => {
        prestigeStats[level].users.forEach(user => {
            allUsers.push(user);
        });
    });
    
    // Сортируем по уровню престижа (по убыванию)
    allUsers.sort((a, b) => {
        if (b.prestige !== a.prestige) {
            return b.prestige - a.prestige;
        }
        return b.cats - a.cats;
    });
    
    // Берем топ-10
    const topUsers = allUsers.slice(0, 10);
    
    let listHTML = '';
    
    topUsers.forEach((user, index) => {
        listHTML += `
            <div class="prestige-user">
                <div class="user-info">
                    <div class="user-rank">${index + 1}.</div>
                    <div class="user-name" title="${user.id}">${user.name}</div>
                </div>
                <div class="user-prestige" style="color: ${PRESTIGE_COLORS[user.prestige] || PRESTIGE_COLORS[0]}">
                    Уровень ${user.prestige}
                </div>
            </div>
        `;
    });
    
    if (topUsers.length === 0) {
        listHTML = '<div class="empty-message">Нет данных о престижах</div>';
    }
    
    topPrestigeList.innerHTML = listHTML;
}

// Фильтрация и сортировка данных
function getFilteredAndSortedData() {
    let filtered = [...catsArray];

    // Применение поиска
    if (currentSearch) {
        const searchLower = currentSearch.toLowerCase();
        filtered = filtered.filter(cat => {
            return (
                (cat.name && cat.name.toString().toLowerCase().includes(searchLower)) ||
                (cat.nickname && cat.nickname.toString().toLowerCase().includes(searchLower)) ||
                (cat.id && cat.id.toString().toLowerCase().includes(searchLower))
            );
        });
    }

    // Применение фильтра
    switch (currentFilter) {
        case 'with_inventory':
            filtered = filtered.filter(cat => cat.inventory && Object.keys(cat.inventory).length > 0);
            break;
        case 'no_inventory':
            filtered = filtered.filter(cat => !cat.inventory || Object.keys(cat.inventory).length === 0);
            break;
        case 'high_prestige':
            filtered = filtered.filter(cat => (cat.prestige_level || 0) >= 3);
            break;
        case 'no_prestige':
            filtered = filtered.filter(cat => !cat.prestige_level || cat.prestige_level === 0);
            break;
        case 'many_cats':
            filtered = filtered.filter(cat => (cat.cats || 0) >= 1000);
            break;
        case 'few_cats':
            filtered = filtered.filter(cat => (cat.cats || 0) < 100);
            break;
        // 'all' - без фильтра
    }

    // Применение сортировки
    filtered.sort((a, b) => {
        switch (currentSort) {
            case 'cats_desc':
                return (b.cats || 0) - (a.cats || 0);
            case 'cats_asc':
                return (a.cats || 0) - (b.cats || 0);
            case 'success_desc':
                return (b.successful_attacks || 0) - (a.successful_attacks || 0);
            case 'success_asc':
                return (a.successful_attacks || 0) - (b.successful_attacks || 0);
            case 'attacks_desc':
                return (b.attacks || 0) - (a.attacks || 0);
            case 'attacks_asc':
                return (a.attacks || 0) - (b.attacks || 0);
            case 'prestige_desc':
                return (b.prestige_level || 0) - (a.prestige_level || 0);
            case 'prestige_asc':
                return (a.prestige_level || 0) - (b.prestige_level || 0);
            case 'name_asc':
                return (a.name || '').toString().localeCompare((b.name || '').toString());
            case 'name_desc':
                return (b.name || '').toString().localeCompare((a.name || '').toString());
            default:
                return 0;
        }
    });

    return filtered;
}

// Обновление таблицы
function updateTable() {
    const filteredData = getFilteredAndSortedData();
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    
    // Корректировка текущей страницы
    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    } else if (currentPage < 1 && filteredData.length > 0) {
        currentPage = 1;
    }
    
    // Получение данных для текущей страницы
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);

    // Очистка таблицы
    tableBody.innerHTML = '';

    if (pageData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-message">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px;"></i><br>
                    Нет данных, соответствующих критериям поиска
                </td>
            </tr>
        `;
        updatePagination(filteredData.length, totalPages);
        return;
    }

    // Заполнение таблицы
    pageData.forEach(cat => {
        const prestigeLevel = cat.prestige_level || 0;
        const prestigeClass = `prestige-${prestigeLevel}`;
        
        // Форматирование инвентаря
        let inventoryHTML = 'Нет';
        if (cat.inventory && Object.keys(cat.inventory).length > 0) {
            const items = Object.keys(cat.inventory).map(item => {
                const itemData = cat.inventory[item];
                let displayText = item;
                
                // Форматирование названий предметов
                if (item === 'machine_gun') displayText = 'Пулемет';
                else if (item === 'hydrogen_bomb') displayText = 'Водородная бомба';
                else if (item === 'concentration_camp') displayText = 'Концентрационный лагерь';
                else if (item === 'ass_glue') displayText = 'Клей';
                else if (item === 'bark_pants') displayText = 'Кора-штаны';
                else if (item === 'trap') displayText = 'Ловушка';
                
                if (typeof itemData === 'object' && itemData.count !== undefined) {
                    return `${displayText} (${itemData.count})`;
                } else if (typeof itemData === 'number') {
                    return `${displayText} (${itemData})`;
                } else {
                    return displayText;
                }
            });
            
            inventoryHTML = items.map(item => `<span class="inventory-item">${item}</span>`).join('');
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="id-cell">${cat.id || 'Не указан'}</td>
            <td class="name-cell">${cat.name || 'Не указано'}</td>
            <td>${cat.nickname || 'Не указан'}</td>
            <td class="cats-cell">${(cat.cats || 0).toLocaleString()}</td>
            <td class="prestige-cell ${prestigeClass}">${prestigeLevel}</td>
            <td>${(cat.attacks || 0).toLocaleString()}</td>
            <td>${(cat.successful_attacks || 0).toLocaleString()}</td>
            <td>${(cat.matroskin || 0).toLocaleString()}</td>
            <td class="inventory-cell">${inventoryHTML}</td>
        `;
        tableBody.appendChild(row);
    });

    updatePagination(filteredData.length, totalPages);
}

// Обновление пагинации
function updatePagination(totalItems, totalPages) {
    pagination.innerHTML = '';

    if (totalPages <= 1) return;

    // Кнопка "Назад"
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updateTable();
        }
    });
    pagination.appendChild(prevButton);

    // Номера страниц
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
        const firstButton = document.createElement('button');
        firstButton.textContent = '1';
        firstButton.addEventListener('click', () => {
            currentPage = 1;
            updateTable();
        });
        pagination.appendChild(firstButton);

        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '10px';
            ellipsis.style.color = '#a5b1c2';
            pagination.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        if (i === currentPage) {
            pageButton.classList.add('active');
        }
        pageButton.addEventListener('click', () => {
            currentPage = i;
            updateTable();
        });
        pagination.appendChild(pageButton);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '10px';
            ellipsis.style.color = '#a5b1c2';
            pagination.appendChild(ellipsis);
        }

        const lastButton = document.createElement('button');
        lastButton.textContent = totalPages;
        lastButton.addEventListener('click', () => {
            currentPage = totalPages;
            updateTable();
        });
        pagination.appendChild(lastButton);
    }

    // Кнопка "Вперед"
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            updateTable();
        }
    });
    pagination.appendChild(nextButton);
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Поиск
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        currentPage = 1;
        updateTable();
    });

    // Сортировка
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        updateTable();
    });

    // Фильтрация
    filterSelect.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        currentPage = 1;
        updateTable();
    });

    // Обновление данных
    refreshBtn.addEventListener('click', async () => {
        showLoading(true);
        try {
            await refreshData();
        } catch (error) {
            console.error('Error manually refreshing data:', error);
        } finally {
            showLoading(false);
        }
    });

    // Переключение автообновления
    toggleAutoRefreshBtn.addEventListener('click', toggleAutoRefresh);

    // Изменение интервала
    changeIntervalBtn.addEventListener('click', () => {
        intervalModal.style.display = 'flex';
        
        // Устанавливаем текущий интервал
        const currentRadio = document.querySelector(`input[name="interval"][value="${refreshInterval}"]`);
        if (currentRadio) {
            currentRadio.checked = true;
        }
    });

    // Применение интервала
    applyIntervalBtn.addEventListener('click', () => {
        const selectedInterval = document.querySelector('input[name="interval"]:checked').value;
        changeRefreshInterval(parseInt(selectedInterval));
        intervalModal.style.display = 'none';
    });

    // Отмена изменения интервала
    cancelIntervalBtn.addEventListener('click', () => {
        intervalModal.style.display = 'none';
    });

    // Закрытие модального окна при клике вне его
    intervalModal.addEventListener('click', (e) => {
        if (e.target === intervalModal) {
            intervalModal.style.display = 'none';
        }
    });

    // Сортировка по клику на заголовок таблицы
    document.querySelectorAll('.cats-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const sortField = th.getAttribute('data-sort');
            
            // Определение направления сортировки
            if (currentSort === `${sortField}_asc`) {
                currentSort = `${sortField}_desc`;
            } else {
                currentSort = `${sortField}_asc`;
            }
            
            // Обновление выпадающего списка
            sortSelect.value = currentSort;
            updateTable();
        });
    });
}

// Запуск приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', init);