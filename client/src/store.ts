import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { mockApi } from './services/mockApi';

type CatalogState = { selectedVariantId: string };
const catalogSlice = createSlice({
  name: 'catalog', initialState: { selectedVariantId: 'bb-chicken-15' } as CatalogState,
  reducers: { selectVariant: (state, action: PayloadAction<string>) => { state.selectedVariantId = action.payload; } },
});

export const { selectVariant } = catalogSlice.actions;
export const store = configureStore({
  reducer: { catalog: catalogSlice.reducer, [mockApi.reducerPath]: mockApi.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(mockApi.middleware),
});
export type RootState = ReturnType<typeof store.getState>;
