-- Pin search_path on private document-code helper functions (advisor 0011_function_search_path_mutable).
alter function private.document_date_code(date) set search_path = '';
alter function private.document_name_code(text) set search_path = '';

notify pgrst, 'reload schema';
