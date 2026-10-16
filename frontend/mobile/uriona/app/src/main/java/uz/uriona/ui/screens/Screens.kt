package uz.uriona.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.painterResource
import uz.uriona.R
import kotlinx.coroutines.launch
import uz.uriona.data.*
import uz.uriona.designsystem.*
import uz.uriona.ui.components.*

@Composable
fun SplashScreen(onNavigateToHome: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF040817)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(
                painter = painterResource(R.drawable.uriona_logo),
                contentDescription = "Логотип URIONA",
                modifier = Modifier.size(128.dp)
            )
            Text(
                text = "URIONA",
                color = Color.White,
                fontSize = 36.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "O'zbekiston uchun elektron tijorat",
                color = Color.White.copy(alpha = 0.8f),
                fontSize = 14.sp
            )
            Spacer(modifier = Modifier.height(24.dp))
            UrionaButton(text = "Boshlash", onClick = onNavigateToHome)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScaffold(
    onProductClick: (Product) -> Unit,
    cartItems: Map<Product, Int>,
    onAddToCart: (Product) -> Unit,
    onRemoveFromCart: (Product) -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) }
    val repository = remember { UrionaRepository() }
    val scope = rememberCoroutineScope()
    var products by remember { mutableStateOf<List<Product>>(emptyList()) }
    var categories by remember { mutableStateOf<List<CategoryItem>>(emptyList()) }
    var selectedCat by remember { mutableStateOf("all") }
    var searchQuery by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(selectedCat, searchQuery) {
        scope.launch {
            isLoading = true
            products = repository.fetchProducts(keyword = searchQuery, categoryId = selectedCat)
            categories = repository.fetchCategories()
            isLoading = false
        }
    }

    Scaffold(
        bottomBar = {
            NavigationBar(containerColor = SurfaceWhite) {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Home, contentDescription = "Главная") },
                    label = { Text("Главная") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.List, contentDescription = "Категории") },
                    label = { Text("Категории") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.ShoppingCart, contentDescription = "Корзина") },
                    label = { Text("Корзина") }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = { Icon(Icons.Default.Person, contentDescription = "Профиль") },
                    label = { Text("Профиль") }
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                0 -> HomeScreen(
                    products = products,
                    categories = categories,
                    selectedCat = selectedCat,
                    onSelectCategory = { selectedCat = it },
                    searchQuery = searchQuery,
                    onSearchChange = { searchQuery = it },
                    isLoading = isLoading,
                    onProductClick = onProductClick
                )
                1 -> CategoriesScreen(
                    categories = categories,
                    onSelectCategory = { catId ->
                        selectedCat = catId
                        selectedTab = 0
                    }
                )
                2 -> CartScreen(
                    cartItems = cartItems,
                    onAddToCart = onAddToCart,
                    onRemoveFromCart = onRemoveFromCart
                )
                3 -> ProfileScreen()
            }
        }
    }
}

@Composable
fun HomeScreen(
    products: List<Product>,
    categories: List<CategoryItem>,
    selectedCat: String,
    onSelectCategory: (String) -> Unit,
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    isLoading: Boolean,
    onProductClick: (Product) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundLight)
            .padding(16.dp)
    ) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Uriona bo'yicha qidirish...") },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
            singleLine = true,
            shape = MaterialTheme.shapes.medium
        )
        Spacer(modifier = Modifier.height(12.dp))

        if (categories.isNotEmpty()) {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(categories) { category ->
                    val isSelected = category.id == selectedCat
                    Button(
                        onClick = { onSelectCategory(category.id) },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isSelected) BrandRed else SurfaceWhite,
                            contentColor = if (isSelected) Color.White else InkDark
                        )
                    ) {
                        Text(text = category.name)
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = BrandRed)
            }
        } else if (products.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(text = "Mahsulotlar topilmadi", color = MutedGray)
            }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                items(products.chunked(2)) { rowProducts ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        for (product in rowProducts) {
                            Box(modifier = Modifier.weight(1f)) {
                                UrionaProductCard(
                                    title = product.title,
                                    price = product.price,
                                    imageUrl = product.imageUrl,
                                    onClick = { onProductClick(product) }
                                )
                            }
                        }
                        if (rowProducts.size == 1) {
                            Spacer(modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun CategoriesScreen(categories: List<CategoryItem>, onSelectCategory: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundLight)
            .padding(16.dp)
    ) {
        Text(text = "Barcha kategoriyalar", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = InkDark)
        Spacer(modifier = Modifier.height(16.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(categories) { category ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { onSelectCategory(category.id) },
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(text = category.name, fontSize = 16.sp, fontWeight = FontWeight.Medium, color = InkDark)
                        Icon(Icons.Default.KeyboardArrowRight, contentDescription = null, tint = MutedGray)
                    }
                }
            }
        }
    }
}

@Composable
fun CartScreen(
    cartItems: Map<Product, Int>,
    onAddToCart: (Product) -> Unit,
    onRemoveFromCart: (Product) -> Unit
) {
    val subtotal = cartItems.entries.sumOf { (product, qty) -> product.priceMinor * qty }
    val shipping = if (cartItems.isNotEmpty()) 35000L else 0L
    val total = subtotal + shipping

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundLight)
            .padding(16.dp)
    ) {
        Text(text = "Savat", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = InkDark)
        Spacer(modifier = Modifier.height(16.dp))

        if (cartItems.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.ShoppingCart, contentDescription = null, modifier = Modifier.size(64.dp), tint = MutedGray)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(text = "Savatingiz bo'sh", color = MutedGray, fontSize = 16.sp)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(cartItems.entries.toList()) { (product, qty) ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(text = product.title, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 2)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(text = product.price, fontSize = 14.sp, fontWeight = FontWeight.Bold, color = BrandRed)
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(onClick = { onRemoveFromCart(product) }) {
                                    Icon(Icons.Default.Delete, contentDescription = "Kamaytirish")
                                }
                                Text(text = "$qty", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                IconButton(onClick = { onAddToCart(product) }) {
                                    Icon(Icons.Default.Add, contentDescription = "Qo'shish")
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Mahsulotlar:")
                        Text(text = "$subtotal UZS", fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Yetkazib berish (Xitoydan):")
                        Text(text = "$shipping UZS", fontWeight = FontWeight.Bold)
                    }
                    Divider(modifier = Modifier.padding(vertical = 8.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(text = "Jami:", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        Text(text = "$total UZS", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = BrandRed)
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                    UrionaButton(text = "Buyurtma berish", onClick = {}, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}

@Composable
fun ProfileScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BackgroundLight)
            .padding(16.dp)
    ) {
        Text(text = "Profil", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = InkDark)
        Spacer(modifier = Modifier.height(16.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Foydalanuvchi", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Text(text = "+998 90 123 45 67", color = MutedGray)
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(text = "Buyurtmalarim", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "Hozircha buyurtmalar yo'q", color = MutedGray)
            }
        }
    }
}

@Composable
fun ProductDetailScreen(product: Product, onBack: () -> Unit, onAddToCart: (Product) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(SurfaceWhite)
            .padding(16.dp)
    ) {
        Button(onClick = onBack) {
            Text("Orqaga")
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text(text = product.title, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = InkDark)
        Spacer(modifier = Modifier.height(8.dp))
        Text(text = product.price, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = BrandRed)
        Spacer(modifier = Modifier.height(24.dp))
        UrionaButton(
            text = "Savatga qo'shish",
            onClick = { onAddToCart(product) },
            modifier = Modifier.fillMaxWidth()
        )
    }
}

@Preview(showBackground = true)
@Composable
fun SplashScreenPreview() {
    UrionaTheme {
        SplashScreen(onNavigateToHome = {})
    }
}

@Preview(showBackground = true)
@Composable
fun HomeScreenPreview() {
    UrionaTheme {
        HomeScreen(
            products = listOf(
                Product("1", "Smart Watch T800", "450,000 UZS", 450000, null, "electronics"),
                Product("2", "Wireless Earbuds Pro", "280,000 UZS", 280000, null, "electronics")
            ),
            categories = listOf(
                CategoryItem("all", "Barchasi"),
                CategoryItem("electronics", "Elektronika")
            ),
            selectedCat = "all",
            onSelectCategory = {},
            searchQuery = "",
            onSearchChange = {},
            isLoading = false,
            onProductClick = {}
        )
    }
}
