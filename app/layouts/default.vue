<template>
  <div class="min-h-screen flex bg-toss-gray-50">
    <AppSidebar />
    <div class="flex-1 min-w-0 flex flex-col">
      <AppMobileNav />
      <main class="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
        <slot />
      </main>
    </div>
    <CommandPalette />
  </div>
</template>
